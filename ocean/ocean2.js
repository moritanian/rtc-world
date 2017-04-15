/*
	Modelloader 導入
	
	改善点
	- loadの複雑な分岐解消
	- meshのuuidをinstanceIdに使用できる　

	懸念点
	- sceneに追加部分
		camera とのグループにしている場合、
		グループごとsceneにaddするべきかmodelのmeshだけでいいのか
	- loader完了とmyId取得の両方を待ちたい
	- instanceId をmeshのを使うとして、衝突時に子要素で検出された場合の対応

	#残件
	- channel開通後にloadedfunc実行

	
*/
/*
	ここでoceanの3dモデル構築を行う
	外部ではthree.js の関数を直接よぶことはないようにする
*/
var Ocean = (function(){
//Ocean: {	

	// 
	var scene, camera, water, renderer, controls, tracking;
	var x_filter, y_filter, z_filter;
	var count = 0, isFlowTracking, camInitPos, lastTime, deltaTime;
	var Instance;
	let isLockSideScreen; // 横に画面を固定する
	let bulletData;　
	let controlCallback; // control用callback
	let controlFighterId;
	let animateCallback;
	let isOrbitControl, isUseChanel;

	let audioSources;

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

	let fighterGroup;
	let bulletGroup;
	let modelLoader;
	let meterControllers;

	let ModelLoader = (function(){
		let modelLength;
		let loadedNum ;
		let loadedFuncs;
		var ModelLoader = function(models, parentObj){
			modelLength = Object.keys(models).length;
			loadedNum = 0;
			loadedFuncs = [];
			for(let modelName in models){
				var json_loader = new THREE.ObjectLoader();　
				let model = models[modelName];
				json_loader.load(model.path, mesh => {　
					//let result = computeFaceNormalsRecursively(mesh);
					//console.log(result);
					model.meshPool = new MeshPool(mesh, parentObj);
					loadedNum++;
					if(loadedNum == modelLength){
						for(let index in loadedFuncs){
							loadedFuncs[index]();
						}
					}
				});
			}
		}

		// すでに完了していれば即実行、まだなら
		ModelLoader.prototype.funcBuffered = function(func){
			if(modelLength == loadedNum){
				func();
			}else {
				loadedFuncs.push(func);
			}
		}

		ModelLoader.prototype.hasFinished = function(){
			return loadedNum == modelLength;
		}

		return ModelLoader; 
	})();

	let audioController = (function(){
		let audioSources;

		let AudioController = function(){
			audioSources = {
				fighter_audio : new Audio("./sound/fighter.mp3"),
				wave_audio : new Audio("./sound/wave.mp3"),
				whistle_audio : new Audio("./sound/whistle.mp3"),
				shoot_audio : new Audio("./sound/shoot.mp3"),
				bomb_audio : new Audio("./sound/bomb1.mp3"),
				explosion_audio : new Audio("./sound/explosion.mp3")	
			};
			for(let i in audioSources){
				audioSources[i].load();
			}
		};

		AudioController.prototype.play = function(sourceName, loop = false){
			if(audioSources[sourceName]){
				if(loop)
					audioSources[sourceName].loop = loop ? true : false;
				audioSources[sourceName].pause();
				audioSources[sourceName].currentTime = 0;
				audioSources[sourceName].play();
			}
		}

		AudioController.prototype.stop = function(sourceName){
			if(audioSources[sourceName]){
				audioSources[sourceName].pause();
				audioSources[sourceName].currentTime = 0;
			}
		}

		AudioController.prototype.onClickInitialize = function(bgmSource = ""){
			for(let name in audioSources){
				let audio = audioSources[name];
				if(name === bgmSource){
					audio.loop = true;
					audio.play();
				} else {
					audio.volume = 0;
					audio.play();
					audio.pause();
					audio.volume = 1.0;			
				}

			}
		}

		return new AudioController();
	})();



	// constructor
	/*
		option {
			animateCallback: function(){},
			isUseChanel,bgm
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
		isOrbitControl = option.isOrbitControl ? true : false;
		isFlowTracking = option.isFlowTracking ? true : false;
		animateCallback = option.animateCallback;
		camInitPos = option.camera.pos || [0,0,0];
		isUseChanel = option.isUseChanel || false;
		isLockSideScreen = option.isLockSideScreen || false;

		let succsessFunc = option.succsessFunc || function(){};

		THREE.LinearMipMapLinearFilter = 1008;

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

		if(isUseChanel){
			let defaultChannelName = "ocean";
			let channelName = option.chanelName || defaultChannelName;
			initChannel(channelName, succsessFunc);
		} else {
			modelLoader.funcBuffered(function(){
				succsessFunc(Instance);
			});
		}

		initScene();		
		modelLoader = new ModelLoader(Ocean.Models, fighterGroup);

		if(option.meters){
			meterControllers = {
				feet: new MeterController("FEET", option.meters.feet),
				compass: new MeterController("COMPASS", option.meters.compass)
			};
		}
		
	};

	function initChannel(channelName, succsessFunc){
		

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
			}else if(msgObj.type === ChannelMsgTypes.func){
				console.log("obj func received");
				channelFuncs[msgObj.funcName].apply(this, _userId, msgObj.args); // これでいけてる？
			}
        };

	         // 接続終了
        var closed_callback = function(connectionCount, _userId){
            console.log("connection closed callback" + connectionCount);
            deleteMember(_userId);
        }

        var socket_connected_callback = function(id){
        	myId = id;
			console.log(myId);
			members[myId] = {
				startTime: startTime
			};

			// すでにmodelよみこまれていれば後続の処理開始
			// まだならbufferに追加
			modelLoader.funcBuffered(function(){
				succsessFunc(Instance);
			});
        }

		chanelControl = new Chanel(connected_callback, msg_get_callback, closed_callback, channelName, socket_connected_callback)
		startTime = getTime();
	}

	function initScene(){
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

		renderer = new THREE.WebGLRenderer({antialias: false});
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

		if(isOrbitControl){
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

		//water.instanceId = "water";
		//mirrorMesh.instanceId = "mirroeMesh";
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
		//skyBox.instanceId = "skyBox";

		scene.add( skyBox );

		/*
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
		*/

		bulletGroup = new THREE.Group();
		scene.add(bulletGroup);

		fighterGroup = new THREE.Group();
		scene.add(fighterGroup);

		//modelLoader.funcBuffered(animate);
		animate();
	}

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

	/*
		funcObjでよびだされる関数郡
		第一引数には senderId が入る
	*/
	let channelFuncs = {
		"destroyObj": function(senderId, instanceId){
			let fighter = fighterInstances[instanceId];
			if(fighter && fighter.mesh){
				fighter.mesh.visible = false;
			}
		},
		"shotBullet": function(senderId, fighterId){
			Instance.oneShoot(fighterId)
		},

		"beShot": function(senderId, instanceId){
			let fighter = fighterInstances[instanceId];
			if(fighter && fighter.mesh){
				beShotFighter(instanceId);
			}
		}


	};

	// type = func でpublish
	Ocean.prototype.publishFunc = function(funcName, _userId){
		let sliced =Array.prototype.slice.call(arguments, 1);
		console.log(sliced);
		let msgObj = {
			type: ChannelMsgTypes.Func,
			funcName: funcName,
			args: sliced // 2番目以降取得
		}
    	sendDataChannel(msgObj, _userId);
	}

	function animate(){
		requestAnimationFrame( animate );
		let option = {}; // option for animateCallback

		if(controlCallback){
			let result = controlCallback();
			Instance.controlFighter(result.control);
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

		updateBullets();

		if(animateCallback){
			if(controlFighterId && fighterInstances[controlFighterId].mesh){
				animateCallback(fighterInstances[controlFighterId].mesh, option);
			}else {
				if(camera)
					animateCallback(camera, option);
			}
		}

		render();
	};

	function render(){
		var time = performance.now() * 0.001;
		deltaTime = (time - lastTime) || 0.0;
		lastTime = time;

		/*
		sphere.position.y = Math.sin( time ) * 500 + 250;
		sphere.rotation.x = time * 0.5;
		sphere.rotation.z = time * 0.51;
	*/

		water.material.uniforms.time.value += 1.0 / 60.0;
		if(isOrbitControl){
			controls.update();
		}
		water.render();
		renderer.render( scene, camera );
	}

	// start ボタンを押す
	// このタイミングでスマホ用にaudioを流す
	// TODO 
	Ocean.prototype.OnClickStart = function(bgm){
		audioController.onClickInitialize(bgm);
	};


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
	Ocean.prototype.addFighter = function(fighterData, instanceId){
		let modelName = fighterData.modelName;
		let model = Ocean.Models[modelName];
		if(!model){
			return 0;
		}

		console.log(modelName);

		let mesh = model.meshPool.instantiate(instanceId, false);
		let targetMesh = setMesh(mesh, fighterData);
		model.meshPool.parentObj.add(targetMesh);

		fighterInstances[instanceId] = {
			modelName: modelName,
			mesh: targetMesh,
			vel: new THREE.Vector3(0,0,1000),
			userId: fighterData.userId,
			nonCollision: fighterData.nonCollision ? true : false
		};	
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
			camera.position.set(0,0, 0);
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

		targetObj.updateMatrix();
		//targetObj.geometry.applyMatrix(mesh.matrix);
		targetObj.matrix.identity();

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
		let pool = new MeshPool(mesh, bulletGroup);
		bulletData = {
			meshPool: pool,	
			bulletList: []
		};
	}

	// 弾丸
	function updateBullets(){
		if(!bulletData)
			return;
		for(let bulletObj of bulletData.bulletList){
        	if(bulletObj.life <= 0){
        		continue;
        	}
        	bulletObj.mesh.position.x += bulletObj.vel.x * deltaTime;
        	bulletObj.mesh.position.y += bulletObj.vel.y * deltaTime;
        	bulletObj.mesh.position.z += bulletObj.vel.z * deltaTime;
        	bulletObj.life-= deltaTime;

        	// bulletはpool しておき、sceneからは消さない
        	if(bulletObj.life <= 0){
        		bulletData.meshPool.release(bulletObj.mesh);

        		// 当たった場合は対象の被弾処理する
        		// TODO 自分が発射した弾のみpublishする　
        		if(bulletObj.beShotObjId){
        			console.log("beshot!!");
        			console.log(bulletObj.beShotObjId);
					Instance.publishFunc("beShot", bulletObj.beShotObjId);
					//beShotFighter();
        			beShotFighter(bulletObj.beShotObjId);
        		}
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
	Ocean.prototype.createFighter = function(fighterData){
		let instanceId = uuid();
		this.addFighter(fighterData, instanceId);
		if(isUseChanel){
			fighterInstances[instanceId].userId = chanelControl.getMyId();
			console.log(chanelControl.getMyId());
			publishObj(instanceId);
		}
		
		return instanceId;
	};

	Ocean.prototype.deleteFighter = function(instanceId){
		fighterGroup.remove(fighterInstances[instanceId].mesh);

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

	Ocean.prototype.setControlFighter = function(instanceId){
		controlFighterId = instanceId;
	}

	Ocean.prototype.controlFighter = function(control){
		if(!fighterInstances[controlFighterId] || !fighterInstances[controlFighterId].mesh){
			return;
		}
		// TODO ランダムなふらつき
		const horizontalCoefficient = 0.05; //左右方向 0.02
		const verticalCoefficient = 0.02; // 上下方向 0.1
		const randomVibrationCoefficient = 10; // 機体の揺れ
		
		let fighter = fighterInstances[controlFighterId];
		fighter.mesh.rotation.order = "YXZ"; // 全て変えちゃう?

		/*
			以下のvel回転ではダメ 速度ベクトルのy方向の回転によって特性がかわってきてしまう
			cameraはもともとz軸の負の方向
		*/
		/*
		let eul = new THREE.Euler( - control.vertical * verticalCoefficient, - control.horizontal* horizontalCoefficient, 0, 'YXZ' );
		// 速度更新
		this.fighterInstances[instanceId].vel.applyEuler(eul);
		*/
		let vel =  fighter.vel;
		let verticalVel = vel.y;
		let horizontalVel = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
		let zeroVec2 = new THREE.Vector2(0,0);

		let rotatedVertical = (new THREE.Vector2(horizontalVel, verticalVel)).rotateAround(zeroVec2,  control.vertical * verticalCoefficient);
		let rotatedHorizontal = (new THREE.Vector2( vel.z, vel.x)).rotateAround(zeroVec2, - control.horizontal* horizontalCoefficient); 
		fighter.vel.y = rotatedVertical.y;
		fighter.vel.x = rotatedHorizontal.y * rotatedVertical.x / horizontalVel;
		fighter.vel.z = rotatedHorizontal.x * rotatedVertical.x / horizontalVel;

		fighter.vel.multiplyScalar(control.acceleration || 1.0);

		//console.log(this.fighterInstances[instanceId].vel);

		// 姿勢
		let alpha = Math.asin(-fighter.vel.clone().normalize().y); // 上下 高さ方向
		if(isNaN(alpha)){
			console.warn("alpha is nan");
		}
		
		let beta = Math.atan2(fighter.vel.x,  fighter.vel.z); // 方角
		let gamma = control.horizontal; // 奥行方向回転
		fighter.mesh.rotation.set(alpha, beta, gamma);
		// 位置
		let deletaPos = fighter.vel.clone().multiplyScalar(deltaTime);
		let randomVibration = new THREE.Vector3(Math.random()*2 -1, Math.random()*2 -1, Math.random()*2 -1); 
		randomVibration.multiplyScalar(randomVibrationCoefficient);
		deletaPos.add(randomVibration);
		fighter.mesh.position.add(deletaPos);

		let limit = 10;
		if(fighter.mesh.position.y < limit){
			fighter.mesh.position.y = limit
		}
		meterControllers.compass.rotatePoint(beta/Math.PI*180);

		meterControllers.feet.rotatePoint(fighter.mesh.position.y /100);

		publishObj(controlFighterId);


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
		audioController.play("shoot_audio");

 		let bulletSpeed = 100000; // 100000
 		if(!bulletData){
 			initBulletMesh();
 		}
		let clonebullet = bulletData.meshPool.instantiate();
		let fighter = fighterInstances[fighterInstanceId];
		clonebullet.position.x = fighter.mesh.position.x; 
		clonebullet.position.y = fighter.mesh.position.y - 140; 
		clonebullet.position.z = fighter.mesh.position.z;

		//scene.add(clonebullet);

		let life = 2; // default time(s)
		let directon = fighter.vel.clone().normalize();
		let ray = new THREE.Raycaster(clonebullet.position, directon);
		let beShotObjId;
        let objs = ray.intersectObjects( fighterGroup.children, true);
    	if(objs.length > 0){
    		let obj = objs[0];
    		let dist = obj.distance;
    		console.log(dist);
    		life = dist/bulletSpeed;
    		console.log(life);
    		beShotObjId = getInstanceIdFromMeshRecursively(obj.object);
    	}

		let bulletObj = {
			mesh: clonebullet,
			vel: fighter.vel.clone().normalize().multiplyScalar(bulletSpeed),
			life: life,
			beShotObjId : beShotObjId // 被弾するオブジェクト
		};
		bulletData.bulletList.push(bulletObj);
	}

	function getInstanceIdFromMeshRecursively(mesh, depth = 0){
		if(!mesh.instanceId)
		{
			if(depth > 20){
				console.warning("getInstanceIdFromMeshRecursively too deep");
			}
			if(!mesh.parent )
				return 0; 
			return getInstanceIdFromMeshRecursively(mesh.parent, depth + 1);
		}
		console.log(mesh.instanceId);
		return mesh.instanceId;

	}

	function computeFaceNormalsRecursively(mesh, depth = 0){
		let result = false;
		if(depth > 20){
			return false;
		}
		if(!mesh.geometry){
			if(mesh.children){
				for(var child of mesh.children){
					if(computeFaceNormalsRecursively(child, depth + 1))
						result = true;
				}
				return result;
			}else {
				return false;
			}
		}
		mesh.geometry.computeFaceNormals();
		return true;
	}

	function sendMyInfo(){
		let msgObj = {
			type: ChannelMsgTypes.MyInfo,
			startTime: startTime,
			nickName: "sampleName"
		}
	}

	/* <summary> 
      channel経由でメッセージを送る
      </summary>
      <msgObj/>
      <_userId> 送り先のuserId (option) </_userId>
    */
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

	// 被弾処理
	function beShotFighter(instanceId){
		let fighter = fighterInstances[instanceId];
		if(!fighter)
			return;

		audioController.play("explosion_audio");
		Instance.deleteFighter(instanceId);
		//fighter.userId 
	}

	let MeterController = (function(){
		let MeterController = function(name, $parent){
			this.name = name;
			this.canvas = initMeter.call(this, name, $parent);
		}

		MeterController.prototype.rotatePoint = function(deg){
			this.$arrow.css("transform", `rotateZ(${deg}deg)`);
		}

		function initMeter(name, $parent){
			//let $canvas = $("canvas");
			 var canvas = document.createElement("canvas");
			$canvas = $(canvas);
			$canvas.attr("width", 120);
			$canvas.attr("height", 120);
			$canvas.width("100%");
			$parent.append($canvas);

			this.$arrow = $("<div>");
			this.$arrow.addClass("arrow");
			$parent.append(this.$arrow);

			//let ctx = $canvas.get(0).getContext('2d');
			//let canvas = $canvas.get(0);
			var ctx = canvas.getContext('2d');
			  //ctx.globalAlpha = 0.5;
			(function(target) {
				if (!target || !target.prototype)
					return;
				target.prototype.arrow = function(startX, startY, endX, endY, controlPoints) {
			    	var dx = endX - startX;
			    	var dy = endY - startY;
			    	var len = Math.sqrt(dx * dx + dy * dy);
			    	var sin = dy / len;
			    	var cos = dx / len;
			    	var a = [];
			    	a.push(0, 0);
				    for (var i = 0; i < controlPoints.length; i += 2) {
				    	var x = controlPoints[i];
				    	var y = controlPoints[i + 1];
				    	a.push(x < 0 ? len + x : x, y);
				    }
				    a.push(len, 0);
				    for (var i = controlPoints.length; i > 0; i -= 2) {
				    	var x = controlPoints[i - 2];
				    	var y = controlPoints[i - 1];
				    	a.push(x < 0 ? len + x : x, -y);
				    }
				    a.push(0, 0);
				    for (var i = 0; i < a.length; i += 2) {
				    	var x = a[i] * cos - a[i + 1] * sin + startX;
				    	var y = a[i] * sin + a[i + 1] * cos + startY;
				    	if (i === 0) this.moveTo(x, y);
				    	else this.lineTo(x, y);
				    }
			  	};
			})(CanvasRenderingContext2D);
				
			/* 円弧を描く */
			function drawCircle(center, rad) {
				 
				ctx.beginPath();
				//ctx.arc(70, 70, 60, 10 * Math.PI / 180, 80 * Math.PI / 180, true);
				ctx.arc(center[0], center[1], rad, 0, Math.PI*2 ,false);
				ctx.stroke();
			}

			function drawLine(s, g){
				ctx.beginPath();
				ctx.moveTo(s[0], s[1]);
				ctx.lineTo(g[0], g[1]);
				ctx.stroke();
			}

			ctx.strokeStyle = "green";
			ctx.fillStyle = "green";
				
			let center = [60,60];
			drawCircle(center, 60);
			let div = 36;
			let shortRad = 40;
			let longRad = 50;
			for(let i=0; i<div; i++){
				let rad = Math.PI*2*i/div;
				let s = [center[0] + Math.cos(rad)*shortRad, center[1] + Math.sin(rad) * shortRad];
				let g = [center[0] + Math.cos(rad)*longRad, center[1] + Math.sin(rad) * longRad];
				drawLine(s,g);
			}

			let radius = 40;
			let correction = [
				[-3,-5],
				[0,0],
				[-15, 5],
				[-30, 8],
				[-30, 0]
			];
			for(let i=0; i<5; i++){
				let rad = Math.PI*2*(i-1)/4;
				ctx.strokeText(`${(i)*9000}`, center[0] + Math.cos(rad)*radius + correction[i][0], center[1] + Math.sin(rad)*radius + correction[i][1], 80);
			}
			ctx.strokeText(name, center[0] - 15, center[1] + 20, 80);

			function drawArrow(center, rad, radius){
				
				ctx.beginPath();
				ctx.arrow(center[0], center[1], center[0] + Math.cos(rad) * radius, center[1] + Math.sin(rad) * radius, [0, 2, -20, 2, -20, 4]);
				ctx.fill();
			}
			//drawArrow(center, 50, 50);
		}

		return MeterController;

	})();

	return Ocean;
//}	
})();