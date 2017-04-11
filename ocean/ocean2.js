/*
	ここでoceanの3dモデル構築を行う
	外部ではthree.js の関数を直接よぶことはないようにする
*/
var Ocean = (function(){
//Ocean: {	

	// 
	var scene, camera, water, renderer, controls, tracking, meshModels = {};
	var x_filter, y_filter, z_filter;
	var count = 0, isFlowTracking, camInitPos, lastTime, deltaTime;
	var Instance;
	var isLockSideScreen; // 横に画面を固定する
	var bulletData;　
	var controlCallback; // control用callback
	var controlFighterId;
	var screenDirection = function(){
		return window.innerWidth / window.innerHeight < 1.0 ? true : false;
	}

	let fighterInstances;

	const ChannelMsgTypes = {
		Objs: "objs",
		Func: "func",
		MyInfo: "myInfo" // timrStamp
	};

	let onceLog = new OnceLog();

	let chanelControl;
	let members = {};
	let myId;
	let startTime;
	
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
		fighterInstances = {};
		this.isOrbitControl = option.isOrbitControl ? true : false;
		isFlowTracking = option.isFlowTracking ? true : false;
		this.animateCallback = option.animateCallback;
		camInitPos = option.camera.pos || [0,0,0];
		this.isUseChanel = option.isUseChanel || false;
		isLockSideScreen = option.isLockSideScreen || false;

		if(isLockSideScreen){
			$("body").addClass("side-screen");

		}
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

			// 接続開始
			var connected_callback = function(connectionCount, _userId){
				members[_userId] = {};
				sendMyInfo();
				sendWorldInfo(_userId);

	        };

	         // めーっせーじ受信
	        var msg_get_callback = function(msg, _userId){
	            var msgObj = JSON.parse(msg);
	onceLog.log("msg_get_callback", msg);
				if(msgObj.type === ChannelMsgTypes.Objs ){ //追加するobj情報// 参加者への初期情報もこれで伝える
					onceLog.log("msg get objs", msg, 40);
					for(var objId in msgObj.objs){
						if(Instance.getFighterInstanceById(objId)){ // 存在する場合は更新
							Instance.updateFighter(msgObj.objs[objId], objId);
						}else{ // ない場合は追加
							Instance.addFighter(msgObj.objs[objId], objId);				
						}
					}
				}else if(msgObj.type === ChannelMsgTypes.MyInfo){ // 新規加入者がはいってきた
					console.log("get msg enter");
					//console.log("time stamp me: " + this.start_time + "other" + msg_obj.start_time);
					members[_userId].startTime = msgObj.startTime;
					members[_userId].nickName = msgObj.nickName;
					if(isRoomMaster()){
						sendWorldInfo(_userId);
					}
				}
	        };

		         // 接続終了
	        var closed_callback = function(connectionCount, _userId){
	            console.log("connection closed callback" + connectionCount);
	            deleteMember(_userId);
	        }
			chanelControl = new Chanel(connected_callback, msg_get_callback, closed_callback, chanelName)
			startTime = getTime();
			myId  = chanelControl.getMyId();
			console.log(myId);
			members[myId]
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
		if(isLockSideScreen && screenDirection()){ // 横に倒す
			renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize(screen.availHeight,  $(document).width() /*window.innerWidth*/);
			container.appendChild( renderer.domElement );
			scene = new THREE.Scene();
			camera = new THREE.PerspectiveCamera( 55,  screen.availHeight/ window.innerWidth, 0.5, 3000000 );
			
		} else {
			renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize($(document).width() /* window.innerWidth */, screen.availHeight );
			container.appendChild( renderer.domElement );
			scene = new THREE.Scene();
			camera = new THREE.PerspectiveCamera( 55, window.innerWidth / screen.availHeight, 0.5, 3000000 );
		}
		console.log("innerheight", window.innerHeight);
		console.log("height", $(document).height());
		console.log("height", screen.availHeight);

		console.log("innerWidth", window.innerWidth);
		console.log("width", $(document).width());
		
		// 検索バー非標示
		 setTimeout(function(){
		 //	console.log("scroll");
    		window.scrollTo(0,1);
  		}, 5000);
		
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
				//let canvas = $("canvas");
				//canvas = canvas.get(0);
				canvas.width = size;
				canvas.height = size;
				//canvas.classList.add("side-screen");

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
		let option = {}; // option for animateCallback

		if(controlCallback){
			let result = controlCallback();
			Instance.controlFighter(result.instanceId, result.control);
		}
		
		if(isFlowTracking){
			var flow = tracking.get_data();
			option.fps = flow.fps;
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
		}else {
			if(deltaTime){
				option.fps = 1.0/deltaTime;
			}
		}

		if(chanelControl){
			option.memberNum = chanelControl.getMemberCount();
			option.userId = chanelControl.getMyId();
		}

		if(this.animateCallback){
			if(controlFighterId){
				this.animateCallback(fighterInstances[controlFighterId].mesh, option);
			}else {
				this.animateCallback(camera, option);
			}
		}

		render();
	};

	function render(){
		var time = performance.now() * 0.001;
		deltaTime = (time - lastTime) || 0.0;
		lastTime = time;

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

		console.log(modelName);

		if(meshModels[modelName]){
			let mesh = meshModels[modelName].clone();
			let targetMesh = setMesh(mesh, fighterData);
			fighterInstances[instanceId] = {
				modelName: modelName,
				mesh : targetMesh,
				isParentMesh: false,			// 複製されたmesh
				vel: new THREE.Vector3(0,0,10)
			};
			if(meshCallback){
				meshCallback(instanceId);
			}
		}else{
			var json_loader = new THREE.ObjectLoader();　
			// ロード中に存在しないと認識されないようにmeshぬきで作成しておく
			fighterInstances[instanceId] = {
					modelName: modelName,
					isParentMesh: true,
					vel: new THREE.Vector3(0,0,1000),
					userId: fighterData.userId	
				};
				　
			json_loader.load(model.path, mesh => {　
				Ocean.Models[modelName] = mesh;
				fighterInstances[instanceId].mesh = setMesh(mesh, fighterData);

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
			//mesh.rotation.set(fighterData.rot[0], fighterData.rot[1], fighterData.rot[2]);
			//mesh.rotation.set(0, Math.PI, 0);
		}
		
		
		var targetObj;
		// 中心が指定されている場合は入れ子にして中心位置を調整
		if(fighterData.center){
			mesh.position.set(fighterData.center[0], -fighterData.center[1], fighterData.center[2]);
			var parentObj = new THREE.Group();
			parentObj.add(mesh);
			targetObj = parentObj;
		}else {
			targetObj = mesh;
		}
		
		if(fighterData.fixCam){
			camera.rotation.set(0,Math.PI, 0);
			if(fighterData.center){
				targetObj.add(camera);
			}else{
				var parentObj = new THREE.Group();
				parentObj.add(camera);
				parentObj.add(targetObj);
				targetObj = parentObj;
			}
		}

		if(fighterData.rot){
			targetObj.rotation.set(fighterData.rot[0], fighterData.rot[1], fighterData.rot[2]);
		}

		if(fighterData.pos){
			targetObj.position.set(fighterData.pos[0], fighterData.pos[1], fighterData.pos[2]);
		}
		scene.add(targetObj);
		if(fighterData.fixCam){
			console.log(targetObj);
		}

		return targetObj;
	}

	function updateMesh (mesh, fighterData){
		if(fighterData.scale){
			mesh.scale.set(fighterData.scale[0], fighterData.scale[1], fighterData.scale[2]);
		}
		if(fighterData.rot){
			mesh.rotation.set(fighterData.rot[0], fighterData.rot[1], fighterData.rot[2]);
		}
		if(fighterData.pos){
			mesh.position.set(fighterData.pos[0], fighterData.pos[1], fighterData.pos[2]);
		}
	}

	// bulletのmeshを作成
	function initBulletMesh(){
		let mesh = new THREE.Mesh(                                     
 			new THREE.CylinderGeometry(20,20,40,50),                         
 			new THREE.MeshPhongMaterial({                                      
           		color: 0x020202
			}));
		mesh.rotation.x = Math.PI/2;
		bulletData = {
			originMesh: mesh,
			createMesh: function(){
				return this.originMesh.clone();
			},
			bulletList: []
		};
	}

	// 弾丸
	function updateBullets(){
		for(let bulletObj of bulletObjList){
        	if(bulletObj.life == 0){
        		continue;
        	}
        	bulletObj.mesh.position.x += bulletObj.vel.x;
        	bulletObj.mesh.position.y += bulletObj.vel.y;
        	bulletObj.mesh.position.z += bulletObj.vel.z;
        	bulletObj.life--;
        	// bulletはpool しておき、sceneからは消さない
        	if(bulletObj.life <= 0){
        		bulletObj.mesh.visible = false;
        	}
        }
    }

    // mash 更新
	Ocean.prototype.updateFighter = function(fighterData, instanceId){
		if(fighterInstances[instanceId] && fighterInstances[instanceId].mesh){
			updateMesh(fighterInstances[instanceId].mesh, fighterData);
		}
		onceLog.log("updateFigher", fighterData, 30);
	}

	// meshを作成し、chanelに情報を流す
	Ocean.prototype.createFighter = function(fighterData, callback){
		let instanceId = uuid();
		let meshCallback;
		if(this.isUseChanel){
			meshCallback = id => {
				// #TODO ここ直す すぐだとタイミング的に自分のidが取得できない。
				// 自分であることのふらぐたてて使用する際にジッサイのidを読むとか
				setTimeout(i => {
					console.log(id);
					fighterInstances[id].userId = chanelControl.getMyId();
					console.log(chanelControl.getMyId());
					publishObj(id);
					if(callback){
						callback(fighterInstances[id]);
					}
				}, 100);
			}
		}
		this.addFighter(fighterData, instanceId, meshCallback);
		return instanceId;
	};

	Ocean.prototype.deleteFighter = function(instanceId){
		scene.remove(fighterInstances[instanceId].mesh);
		delete fighterInstances[instanceId].mesh;
		delete fighterInstances[instanceId];
	}

	Ocean.prototype.getFighterInstanceById = function(instanceId){
		return fighterInstances[instanceId];
	};

	Ocean.prototype.getInstanceIdsByUserId = function(_userId){
		let ids = [];
		for (let id in fighterInstances){
			let fighter = fighterInstances[id];
			if(fighter.userId == _userId){
				ids.push(id);
			}
		}
		return ids;
	}

	Ocean.prototype.setVelocity = function(instanceId, vel){
		fighterInstances[instanceId].vel = vel;
	}

	Ocean.prototype.addVelocity = function(instanceId, velDelta){
		fighterInstances[instanceId].vel.add(velDelta);
	}

	/* fighter の入力    加速は？
		control {
			horizontal:  // sin(gamma)
			vertical: 	// sin(alpha)
			accelearation
		}
		** 1flameごとに呼び出すこと！！
	*/
	Ocean.prototype.controlFighter = function(instanceId, control){
		if(!fighterInstances[instanceId] || !fighterInstances[instanceId].mesh){
			return;
		}
		// TODO ランダムなふらつき
		controlFighterId = instanceId;
		const horizontalCoefficient = 0.05; //左右方向 0.02
		const verticalCoefficient = 0.02; // 上下方向 0.1
		const randomVibrationCoefficient = 10; // 機体の揺れ
		
		fighterInstances[instanceId].mesh.rotation.order = "YXZ"; // 全て変えちゃう?

		/*
			以下のvel回転ではダメ 速度ベクトルのy方向の回転によって特性がかわってきてしまう
			cameraはもともとz軸の負の方向
		*/
		/*
		let eul = new THREE.Euler( - control.vertical * verticalCoefficient, - control.horizontal* horizontalCoefficient, 0, 'YXZ' );
		// 速度更新
		this.fighterInstances[instanceId].vel.applyEuler(eul);
		*/
		let vel =  fighterInstances[instanceId].vel;
		let verticalVel = vel.y;
		let horizontalVel = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
		let zeroVec2 = new THREE.Vector2(0,0);

		let rotatedVertical = (new THREE.Vector2(horizontalVel, verticalVel)).rotateAround(zeroVec2,  control.vertical * verticalCoefficient);
		let rotatedHorizontal = (new THREE.Vector2( vel.z, vel.x)).rotateAround(zeroVec2, - control.horizontal* horizontalCoefficient); 
		fighterInstances[instanceId].vel.y = rotatedVertical.y;
		fighterInstances[instanceId].vel.x = rotatedHorizontal.y * rotatedVertical.x / horizontalVel;
		fighterInstances[instanceId].vel.z = rotatedHorizontal.x * rotatedVertical.x / horizontalVel;

		fighterInstances[instanceId].vel.multiplyScalar(control.acceleration || 1.0);

		//console.log(this.fighterInstances[instanceId].vel);

		// 姿勢
		let alpha = Math.asin(-fighterInstances[instanceId].vel.clone().normalize().y); // 上下 高さ方向
		if(isNaN(alpha)){
			console.warn("alpha is nan");
		}
		
		let beta = Math.atan2(fighterInstances[instanceId].vel.x,  fighterInstances[instanceId].vel.z); // 方角
		let gamma = control.horizontal; // 奥行方向回転
		fighterInstances[instanceId].mesh.rotation.set(alpha, beta, gamma);
		// 位置
		let deletaPos = fighterInstances[instanceId].vel.clone().multiplyScalar(deltaTime);
		let randomVibration = new THREE.Vector3(Math.random()*2 -1, Math.random()*2 -1, Math.random()*2 -1); 
		randomVibration.multiplyScalar(randomVibrationCoefficient);
		deletaPos.add(randomVibration);
		fighterInstances[instanceId].mesh.position.add(deletaPos);

		publishObj(instanceId);


		/*
		let rightDirection = (new Three.Vector3(0,1,0)).cross(this.fighterInstances[instanceId].vel).normalize();
		// 加速度
		let acc = rightDirection.clone().addScalar(control.horizontal * horizontalCoefficient);
		// 速度更新
		this.fighterInstances[instanceId].vel.add(acc);
		*/
	}

	/* animation ごとに呼び出される制御用callback
		function(){
			return {
				instanceId: 
				control {
					horizontal: 
					vertical:
					acceleration
				}
			}
		}
	*/ 
 	Ocean.prototype.setControlCallback = function(callback){
 		controlCallback = callback;
 	}

	/*
		oceanで使用するデータ(fighterInstances) と　chanelで持っているデータは別形式。
		chanelで持つデータ形式ではmeshやdomオブジェクトをもたない
		
	*/
	function getObjHash(instance, instanceId){
		if(!instance.mesh){
			return {};
		}
		return {
			id: instanceId,
			userId: instance.userId,
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

 	Ocean.prototype.oneShoot = function(fighterInstanceId){
 		if(!bulletData){
 			initBulletMesh();
 		}
		let clonebullet = bulletData.originMesh.clone();
		let fighter = fighterInstances[fighterInstanceId];
		clonebullet.position.x = fighter.mesh.position.x; 
		clonebullet.position.y = fighter.mesh.position.y - 100; 
		clonebullet.position.z = fighter.mesh.position.z;

		scene.add(clonebullet);
		let bulletObj = {
			mesh: clonebullet,
			vel: new THREE.Vector3(0,0, 1000),
			life: 100,
		};
		bulletData.bulletList.push(bulletObj);
	}

	function sendMyInfo(){
		let msgObj = {
			type: ChannelMsgTypes.MyInfo,
			startTime: startTime,
			nickName: "sampleName"
		}
	}

	function sendDataChannel(msgObj, _userId){
		chanelControl.sendAlongDataChanel(JSON.stringify(msgObj), _userId);
	}

	// timeStamp若いのがmaster
	function isRoomMaster(){
		let isMaster = true;
		for(let id in members){	
			if(id == myId)
				continue;
			if(members[id].startTime < startTime){ //自分より前にいる人がいた
				isMaster = false;
				break;
			}
		}
		return isMaster;
	}

	function publishObj(instanceId, _userId){
		publishObjs([instanceId], _userId);
    }

    function publishObjs(instanceIds ,_userId){
    	let msgObj = {};
    	msgObj.type = ChannelMsgTypes.Objs;
    	msgObj.objs = {};
    	for(let id of instanceIds){
			msgObj.objs[id] = getObjHash(fighterInstances[id], id);
    	}
    	sendDataChannel(msgObj, _userId);
    }


	// world情報をchannelで送る
	function sendWorldInfo(_userId){
		publishObjs(Object.keys(fighterInstances), _userId);
	}

	// member を削除し、memberのもつオブジェクト破棄
	function deleteMember(_userId){
		console.log("user_id = " + _userId);
		for (let id of Instance.getInstanceIdsByUserId(_userId)){
			console.log(_userId);
			console.log(id);
			Instance.deleteFighter(id);
		}
		delete members[_userId];
	}

	return Ocean;
//}	
})();