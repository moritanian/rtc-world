/*
	ここでoceanの3dモデル構築を行う
	外部ではthree.js の関数を直接よぶことはないようにする
*/
var Ocean = (function(){
//Ocean: {	

	// 
	var scene, camera, water, renderer, controls, tracking, meshModels = {};
	var x_filter, y_filter, z_filter;
	var count = 0, isFlowTracking, camInitPos;
	var Instance;

	
	// constructor
	/*
		option {
			animateCallback: function(){},
			isUseChanel,
			isFlowTracking: 
			isOrbitControl:
			camera: {
				pos: [],
				target: []
			}

		}

	*/
	var Ocean = function(option){
		Instance = this;
		option = option || {}; // undefine error 対策
		this.fighterInstances = {};
		this.isOrbitControl = option.isOrbitControl ? true : false;
		isFlowTracking = option.isFlowTracking ? true : false;
		this.animateCallback = option.animateCallback;
		camInitPos = option.camera.pos || [0,0,0];
		this.isUseChanel = option.isUseChanel || false;


		if(isFlowTracking){
			// tracking
			tracking = new screen_flow(7, /* debug = */false);
	        x_filter = new LpFilter(0.5);
	        y_filter = new LpFilter(0.5);
	        z_filter = new LpFilter(0.5);
		}

		if(this.isUseChanel){
			let defaultChanelName = "ocean";
			let chanelName = option.chanelName || defaultChanelName;
			let objInfoCallback = function(objId, obj, isNew){
				if(isNew){
					Instance.addFighter(obj, objId);
				}else{
					Instance.updateFighter(obj, objId);
				}
			};
			let chanelOption = {
				limitUserNum: option.limitUserNum,
				connection_changed_func: function(){

				}
			};
			this.chanelControl = new ChanelControl(chanelName, objInfoCallback, chanelOption);
		}

		var parameters = {
				width: 2000,
				height: 2000,
				widthSegments: 250,
				heightSegments: 250,
				depth: 1500,
				param: 4,
				filterparam: 1
			};

		let container = document.createElement( 'div' );
		document.body.appendChild( container );

		renderer = new THREE.WebGLRenderer();
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );
		container.appendChild( renderer.domElement );

		scene = new THREE.Scene();

		camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 0.5, 3000000 );
		camera.position.set( camInitPos[0], camInitPos[1], camInitPos[2]);

		if(this.isOrbitControl){
			controls = new THREE.OrbitControls( camera, renderer.domElement );
			controls.enablePan = false;
			controls.minDistance = 1000.0;
			controls.maxDistance = 5000.0;
			controls.maxPolarAngle = Math.PI * 0.495;
			controls.target.set( camera_init_target_pos[0], camera_init_target_pos[1], camera_init_target_pos[2] );
		}

		scene.add( new THREE.AmbientLight( 0x444444 ) );

		var light = new THREE.DirectionalLight( 0xffffbb, 1 );
		light.position.set( - 1, 1, - 1 );
		scene.add( light );
	   
		let waterNormals = new THREE.TextureLoader().load( 'textures/waternormals.jpg' );
		waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

		water = new THREE.Water( 
			renderer, 
			camera, 
			scene, 
			{
				textureWidth: 512,
				textureHeight: 512,
				waterNormals: waterNormals,
				alpha: 	1.0,
				sunDirection: light.position.clone().normalize(),
				sunColor: 0xffffff,
				waterColor: 0x001e0f,
				distortionScale: 50.0
			} 
		);


		let mirrorMesh = new THREE.Mesh(
			new THREE.PlaneBufferGeometry( parameters.width * 500, parameters.height * 500 ),
			water.material
		);

		mirrorMesh.add( water );
		mirrorMesh.rotation.x = - Math.PI * 0.5;
		scene.add( mirrorMesh );


		// load skybox

		var cubeMap = new THREE.CubeTexture( [] );
		cubeMap.format = THREE.RGBFormat;

		var loader = new THREE.ImageLoader();
		loader.load( 'textures/skyboxsun25degtest.png', function ( image ) {

			var getSide = function ( x, y ) {

				var size = 1024;

				var canvas = document.createElement( 'canvas' );
				canvas.width = size;
				canvas.height = size;

				var context = canvas.getContext( '2d' );
				context.drawImage( image, - x * size, - y * size );

				return canvas;

			};

			cubeMap.images[ 0 ] = getSide( 2, 1 ); // px
			cubeMap.images[ 1 ] = getSide( 0, 1 ); // nx
			cubeMap.images[ 2 ] = getSide( 1, 0 ); // py
			cubeMap.images[ 3 ] = getSide( 1, 2 ); // ny
			cubeMap.images[ 4 ] = getSide( 1, 1 ); // pz
			cubeMap.images[ 5 ] = getSide( 3, 1 ); // nz
			cubeMap.needsUpdate = true;

		} );

		var cubeShader = THREE.ShaderLib[ 'cube' ];
		cubeShader.uniforms[ 'tCube' ].value = cubeMap;

		var skyBoxMaterial = new THREE.ShaderMaterial( {
			fragmentShader: cubeShader.fragmentShader,
			vertexShader: cubeShader.vertexShader,
			uniforms: cubeShader.uniforms,
			depthWrite: false,
			side: THREE.BackSide
		} );

		var skyBox = new THREE.Mesh(
			new THREE.BoxGeometry( 1000000, 1000000, 1000000 ),
			skyBoxMaterial
		);

		scene.add( skyBox );


		var geometry = new THREE.IcosahedronGeometry( 400, 4 );

		for ( var i = 0, j = geometry.faces.length; i < j; i ++ ) {

			geometry.faces[ i ].color.setHex( Math.random() * 0xffffff );

		}

		var material = new THREE.MeshPhongMaterial( {
			vertexColors: THREE.FaceColors,
			shininess: 100,
			envMap: cubeMap
		} );

		sphere = new THREE.Mesh( geometry, material );
		scene.add( sphere );

		animate();
	};

// static member
	Ocean.nationalityList = {
		Japan:{
			en: "Japan",
			jp: "日本"
		},
		Russia:{
			en: "Russia",
			jp: "ロシア"
		},
		Soviet:{
			en: "Soviet Union",
			jp: "ソ連"
		},
		Ameriaca:{
			en: "America",
			jp: "アメリカ"
		}
	};

	Ocean.Models = {
		battle_ship: {
			path: "./objs/battle_ship/ship.json",
			nationality: Ocean.nationalityList.Russia,
			explain: "ステレグシュチイ級フリゲート"
		},
		zero_fighter: {
			path: "./objs/zero_fighter/scene.json",
			nationality: Ocean.nationalityList.Japan,
			explain: "零戦"
		},
		p51_mustang: {
			path: "./objs/p51_mustang/scene.json",
			nationality: Ocean.nationalityList.Ameriaca,
			explain: "P51 マスタング"
		}
	};

	function animate(){
		requestAnimationFrame( animate );
		
		if(isFlowTracking){
			var flow = tracking.get_data();
            let offset = flow.move;
            x_filter.set(offset.x);
            y_filter.set(offset.y);
            z_filter.set(offset.z);
            let move_ratio = 10;
            count -= 0;
            let cameraPos = {
            	x: camInitPos[0] - x_filter.get() * move_ratio,	
            	y: camInitPos[1] + y_filter.get() * move_ratio,	
            	z: camInitPos[2] - z_filter.get() * move_ratio + count	
            };
            if(cameraPos.y <= 0){
            	cameraPos.y = 1;
            }
            camera.position.x = cameraPos.x;
            camera.position.y = cameraPos.y;
            camera.position.z = cameraPos.z;
		}
		if(this.animateCallback){
			this.animateCallback(camera);
		}

		render();
	};

	function render(){
		var time = performance.now() * 0.001;

		sphere.position.y = Math.sin( time ) * 500 + 250;
		sphere.rotation.x = time * 0.5;
		sphere.rotation.z = time * 0.51;

		water.material.uniforms.time.value += 1.0 / 60.0;
		if(isOrbitControl){
			controls.update();
		}
		water.render();
		renderer.render( scene, camera );
	}


	// hash でうけとった戦闘機データを追加する
	// ここで識別するためのid とchanel のid は別にするかも
	/*
		fighterData {
			scale: [],
			rot: [],
			pos: []
			modelName: ""
		}
	*/
	Ocean.prototype.addFighter = function(fighterData, instanceId, meshCallback){
		let modelName = fighterData.modelName;
		let model = Ocean.Models[modelName];
		if(!model){
			return 0;
		}

		if(meshModels[modelName]){
			let mesh = meshModels[modelName].clone();
			setMesh(mesh, fighterData);
			this.fighterInstances[instanceId] = {
				modelName: modelName,
				mesh : mesh,
				isParentMesh: false			// 複製されたmesh
			};
			if(meshCallback){
				meshCallback(instanceId);
			}
		}else{
			var json_loader = new THREE.ObjectLoader();　　
			json_loader.load(model.path, mesh => {　
				Ocean.Models[modelName] = mesh;
				setMesh(mesh, fighterData);
				this.fighterInstances[instanceId] = {
					modelName: modelName,
					mesh : mesh,
					isParentMesh: true			
				};
				meshModels[modelName] = mesh;
				if(meshCallback){
					meshCallback(instanceId);
				}
			});
		}
	};

	function setMesh(mesh, fighterData){
		if(fighterData.scale){
			mesh.scale.set(fighterData.scale[0], fighterData.scale[1], fighterData.scale[2]);
		}
		if(fighterData.rot){
			mesh.rotation.set(fighterData.rot[0], fighterData.rot[1], fighterData.rot[2]);
		}
		if(fighterData.pos){
			mesh.position.set(fighterData.pos[0], fighterData.pos[1], fighterData.pos[2]);
		}
		scene.add(mesh);
	}

	Ocean.prototype.updateFighter = function(fighterData, instanceId){
		setMesh(this.fighterInstances[instanceId].mesh, fighterData);
	}

	Ocean.prototype.createFighter = function(fighterData){
		let instanceId = uuid();
		let meshCallback;
		if(this.isUseChanel){
			meshCallback = id => {
				Instance.chanelControl.updateObj(Instance.getObjHash(Instance.fighterInstances[id], id), id);
			}
		}
		this.addFighter(fighterData, instanceId, meshCallback);
		
		return instanceId;
	};

	Ocean.prototype.getFighterInstanceById = function(instanceId){
		return this.fighterInstances[instanceId];
	};

	/*
		oceanで使用するデータ(fighterInstances) と　chanelで持っているデータは別形式。
		chanelで持つデータ形式ではmeshやdomオブジェクトをもたない
		
	*/
	Ocean.prototype.getObjHash = function(instance, instanceId){
		if(!instance.mesh){
			return {};
		}
		return {
			id: instanceId,
			userId: this.chanelControl.getUserId(),
			modelName: instance.modelName,
			scale: [instance.mesh.scale.x, instance.mesh.scale.y, instance.mesh.scale.z],
			rot: [instance.mesh.rotation.x, instance.mesh.rotation.y, instance.mesh.rotation.z],
			pos: [instance.mesh.position.x, instance.mesh.position.y, instance.mesh.position.z],
		};
	};

	Ocean.prototype.resetTracking = function(){
		if(isFlowTracking){
			tracking.reset();
		}
	}

	return Ocean;
//}	
})();