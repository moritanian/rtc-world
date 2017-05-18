/*
	2017/4/20 残タスク
	- 体力切れアニメーション
	- 機体内を画像に
	- 照準器をcanvasで
	
*/
/*
	ここでoceanの3dモデル構築を行う
	外部ではthree.js の関数を直接よぶことはないようにする

	TODO fighterInstanceをクラス化すべき
	クラスを別ファイルにしたい
*/
var Ocean = (function(){

	// 
	var scene, camera, water, renderer, controls, tracking;
	var x_filter, y_filter, z_filter;
	var count = 0, isFlowTracking, camInitPos, lastTime, deltaTime;
	var Instance;
	let isLockSideScreen; // 横に画面を固定する
	let isInverseScreen;
	let bulletData;　
	let controlCallback; // control用callback
	let controlFighterId;
	let animateCallback;
	let beShotCallback;
	let isOrbitControl, isUseChanel;
	let myScorePoint;

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
	let fireGroup;
	let firePool;
	let modelLoader;
	let meterControllers;
	let enemyPointerController;
	let timeOutModule;

	// カメラ系
	const cameraParams ={
		fov: 55,
		near: 0.5,
		far: 3000000
	}

	// 制御定数係数
	const HORIZONTAL_COEFFICIENT_BASE = 0.05; //左右方向 0.02
	const VERTICAL_COEFFICIENT_BASE = 0.02; // 上下方向 0.1
	const INITIAL_LIFE = 200;
	const POWER_VELOCITY_COEFFICIENT = 10;

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
					if(loadedNum == modelLength){ // 準備完了
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
				explosion_audio : new Audio("./sound/explosion.mp3"),	
				explosion_long_audio : new Audio("./sound/explosion_long.mp3")	
			};
			for(let i in audioSources){
				audioSources[i].load();
			}
		};

		AudioController.prototype.play = function(sourceName, loop = false, volume = 1.0){
			if(audioSources[sourceName]){
				if(loop)
					audioSources[sourceName].loop = loop ? true : false;
				audioSources[sourceName].pause();
				audioSources[sourceName].currentTime = 0;
				audioSources[sourceName].volume = volume;
				audioSources[sourceName].play();
			}
		}

		AudioController.prototype.stop = function(sourceName){
			if(audioSources[sourceName]){
				audioSources[sourceName].pause();
				audioSources[sourceName].currentTime = 0;
			}
		}

		AudioController.prototype.pauseBgm = function(){
			if(audioSources[this.bgmSource]){
				audioSources[this.bgmSource].pause();
			}
		}

		AudioController.prototype.restartBgm = function(){
			if(audioSources[this.bgmSource]){
				audioSources[this.bgmSource].play();
			}
		}

		// スマホブラウザのクリックイベントでしか再生できない問題への対応
		AudioController.prototype.onClickInitialize = function(bgmSource = ""){
			for(let name in audioSources){
				let audio = audioSources[name];
				if(name === bgmSource){
					this.bgmSource = bgmSource;
					audio.loop = true;
					audio.volume = 0.2;
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
			successFunc,
			beShotCallback,
			isUseChanel,bgm
			isFlowTracking: 
			isOrbitControl:
			camera: {
				pos: [],
				target: []
			}
			isLockSideScreen,
			meters: []
			enemyPointerArgs{
				$parentDom,
				$pointerDom
			},
			timeOut: 0(s)

		}

	*/
	var Ocean = function(option){
		this.gameStatus = Ocean.GameStatus.Loading;
		Instance = this;
		option = option || {}; // undefine error 対策
		fighterInstances = {};
		isOrbitControl = option.isOrbitControl ? true : false;
		isFlowTracking = option.isFlowTracking ? true : false;
		animateCallback = option.animateCallback;
		camInitPos = option.camera.pos || [0,0,0];
		isUseChanel = option.isUseChanel || false;
		isLockSideScreen = option.isLockSideScreen || false;
		isInverseScreen = false;
		this.fpsManager = new LpFilter(0.06);

		let succsessFunc = option.succsessFunc || function(){};

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
				Instance.gameStatus = Ocean.GameStatus.Ready;
			});
		}

		this.uiWidgets = $(".ui-widgets");

		initScene();		
		modelLoader = new ModelLoader(Ocean.Models, fighterGroup);
	

		if(option.meters){
			meterControllers = {
				feet: new MeterController("FEET", option.meters.feet),
				compass: new MeterController("COMPASS", option.meters.compass),
				life_gauge : {
					$gauge: option.meters.life_gauge,
					setGauge: function(life){
						this.$gauge.height(`${life / INITIAL_LIFE * 100}%`);
						if(life/ INITIAL_LIFE < 0.4){
							this.$gauge.addClass("danger-status");
						}
					}
				}
			};
		}

		beShotCallback = option.beShotCallback || function(){};
		myScorePoint = 0;
		if(option.enemyPointerArgs)
			enemyPointerController = new EnemyPointer(option.enemyPointerArgs.$parentDom, option.enemyPointerArgs.$pointerDom);

		if(option.timeOut && option.timeOut > 0){
			timeOutModule = {
				timeCount:0,
				timeOut: option.timeOut,
				hasTimeOut: false
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
			}else if(msgObj.type === ChannelMsgTypes.Func){
				console.log("obj func received");
				msgObj.args.unshift(_userId);
				channelFuncs[msgObj.funcName].apply(Instance, msgObj.args); // これでいけてる？
			} else {
				console.warn(`Invalid type message '${msgObj.type}' has been received;`);
			}
        };

	         // 接続終了
        var closed_callback = function(connectionCount, _userId){
            console.log("connection closed callback" + connectionCount);
            deleteMember(_userId);
        }

        var socket_connected_callback = function(id){
        	myId = id;
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

		THREE.LinearMipMapLinearFilter = 1008;	

		let container = document.createElement( 'div' );
		document.body.prepend( container );

		renderer = new THREE.WebGLRenderer({antialias: false});
		
		renderer.domElement.style.position = "relative";
		renderer.domElement.style.left = "-4px";

		if(isLockSideScreen && screenDirection()){ // 横に倒す
			isInverseScreen = true;
			let sc_height = $(document).width() + 4;// screen.availHeight/window.devicePixelRatio; //$(document).width() + 4;
			let sc_width = screen.availHeight;

			console.log("side!! ");
			renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize(sc_width,  sc_height /*window.innerWidth*/);
			container.appendChild( renderer.domElement );
			scene = new THREE.Scene();
			camera = new THREE.PerspectiveCamera( cameraParams.fov,  sc_width/ sc_height, cameraParams.near, cameraParams.far );
			// TODO ここに書きたくない
			$(".ui-widgets").width(sc_width);
			$(".ui-widgets").height(sc_height);
		} else {
			isInverseScreen = false;
			console.log("not side!! ");

			renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize($(document).width() /* window.innerWidth */, screen.availHeight );
			container.appendChild( renderer.domElement );
			scene = new THREE.Scene();
			camera = new THREE.PerspectiveCamera( cameraParams.fov, window.innerWidth / screen.availHeight, cameraParams.near, cameraParams.far );
		}
		
		$(window).on("resize", setScreenSize);
	
		
/*
		// 検索バー非標示
		 setTimeout(function(){
		 	console.log("scroll");
    		window.scrollTo(-200,-200);
  		}, 5000);
*/	

		camera.position.set( camInitPos[0], camInitPos[1], camInitPos[2]);

		if(isOrbitControl){
			controls = new THREE.OrbitControls( camera, renderer.domElement );
			controls.enablePan = false;
			controls.minDistance = 100.0;
			controls.maxDistance = 500.0;
			controls.maxPolarAngle = Math.PI * 0.495;
			controls.target.set( camInitPos[0], camInitPos[1], camInitPos[2]);
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
		(function (){
			var cubeMap = new THREE.CubeTexture( [] );
			cubeMap.format = THREE.RGBFormat;

			var loader = new THREE.ImageLoader();
			let directoryPath = "textures/";
			let skyBoxTextureNames = [
				"skyboxsun5deg.png",
				"skyboxsun5deg2.png",
				"skyboxsun25degtest.png",
				"skyboxsun45deg.png"
			];
			let textureLength = skyBoxTextureNames.length;
			let skyBoxPath = directoryPath + skyBoxTextureNames[Math.floor(Math.random() * textureLength)];

			loader.load( skyBoxPath, function ( image ) {

				var getSide = function ( x, y ) {

					var size = 1024;

					var canvas = document.createElement( 'canvas' );

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

		})();

		

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

		// fire setup
		VolumetricFire.texturePath = './fire/textures/';
		fireGroup = new THREE.Group();
		scene.add(fireGroup);
		firePool = new FirePool(fireGroup);

		//modelLoader.funcBuffered(animate);
		animate();
	}

	function setScreenSize(){
		console.log("setScreenSize");
		/*
		console.log("innerheight", window.innerHeight);
		console.log("outerheight", window.outerHeight);
		console.log("height", $(document).height());
		console.log("availheight", screen.availHeight);

		console.log("innerWidth", window.innerWidth);
		console.log("outerWidth", window.outerWidth);
		console.log("width", $(document).width());
		console.log("avail width", screen.availWidth);
		*/
		
		if(isLockSideScreen && screenDirection()){ // 横に倒す
			isInverseScreen = true;
			let sc_height = $(document).width() + 4;// screen.availHeight/window.devicePixelRatio; //$(document).width() + 4;
			let sc_width = screen.availHeight;
			renderer.setPixelRatio( sc_width/ sc_height );
			renderer.setSize(sc_width, sc_height);
			$(".ui-widgets").width(sc_width);
			$(".ui-widgets").height(sc_height);


		} else {
			isInverseScreen = false;
			let sc_height = window.innerHeight; //screen.availHeight;// screen.availHeight/window.devicePixelRatio; //$(document).width() + 4;
			let sc_width = $(document).width();
			renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize($(document).width() /* window.innerWidth */, screen.availHeight );
			$(".ui-widgets").width(sc_width);
			$(".ui-widgets").height(sc_height);
		}
		if(objectControl)
			objectControl.inverseXY = isInverseScreen;
	}

	function animate(){
		requestAnimationFrame( animate );

		let option = {}; // option for animateCallback
		
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
				Instance.fpsManager.set( 1.0/deltaTime);
				option.fps = Instance.fpsManager.get();
			}
		}

		if(chanelControl){
			option.memberNum = chanelControl.getMemberCount();
			option.userId = chanelControl.getMyId();
		}

		option.myScorePoint = myScorePoint;
		updateBullets();

		if(animateCallback){
			if(controlFighterId && fighterInstances[controlFighterId].mesh){
				animateCallback(fighterInstances[controlFighterId].mesh, option);
			}else {
				if(camera)
					animateCallback(camera, option);
			}
		}

		if(enemyPointerController)
			enemyPointerController.loop();

		render();
	};

	function render(){
		var time = performance.now() * 0.001;
		deltaTime = (time - lastTime) || 0.0;
		lastTime = time;

		// timeOut
		if(timeOutModule && timeOutModule.hasTimeOut == false){
			timeOutModule.timeCount += deltaTime;
			if(timeOutModule.timeCount > timeOutModule.timeOut){
				if (isUseChanel)
					chanelControl.hangUp();
				timeOutModule.hasTimeOut = true;
				console.log("---------  time out!!!!!!  ---------------");
			}
		}

		/*
		sphere.position.y = Math.sin( time ) * 500 + 250;
		sphere.rotation.x = time * 0.5;
		sphere.rotation.z = time * 0.51;
	*/
		if(controlCallback){
			let result = controlCallback();
			Instance.controlFighter(result.control);
		}

		for (let id in fighterInstances)
		{
			let fighter = fighterInstances[id];
			if(!fighter)
				continue;

			for(let fire of fighter.fires)
			{	
	 			fire.update( time );
	 			fire.mesh.position.set(
	 				fighter.mesh.position.x + fire.offsetFromFighter.x,
	 				fighter.mesh.position.y + fire.offsetFromFighter.y,
	 				fighter.mesh.position.z + fire.offsetFromFighter.z
	 				);
			}

			if(fighter.userId == myId && id != controlFighterId){
				if(fighter.angVel)
				{
					let ang = fighter.angVel.clone().multiplyScalar(deltaTime);
					fighter.mesh.rotation.x += ang.x;
					fighter.mesh.rotation.y += ang.y;
					fighter.mesh.rotation.z += ang.z;
				}
				if( fighter.vel)
					fighter.mesh.position.add(fighter.vel.clone().multiplyScalar(deltaTime));
				
				if(fighter.life <= 0 && fighter.mesh.position.y < -1000){
					Instance.deleteFighter(id); // ここで消す
				}
			}

		}

		water.material.uniforms.time.value += 1.0 / 60.0;
		if(isOrbitControl){
			controls.update();
		}
		if(objectControl)
			objectControl.update();
		water.render();
		renderer.render( scene, camera );
	}

// static member
	Ocean.nationalityList = {
		Japan:{
			en: "Japan",
			jp: "日本",
			flag: "./images/flags/Japan.png"
		},
		Russia:{
			en: "Russia",
			jp: "ロシア",
			flag: "./images/flags/Russia.png"
		},
		Soviet:{
			en: "Soviet Union",
			jp: "ソ連",
			flag : "./images/flags/SovietUnion.png"
		},
		America:{
			en: "America",
			jp: "アメリカ",
			flag : "./images/flags/America.png"
		},
		Britain: {
			en : "Britain",
			jp: "イギリス",
			flag: "./images/flags/Britain.png"
		}
	};

	Ocean.ModelTypes = {
		ship: "ship",
		plane: "plane"
	};

	Ocean.Models = {
		battle_ship: {
			type: Ocean.ModelTypes.ship,
			path: "./objs/battle_ship/ship.json",
			nationality: Ocean.nationalityList.Russia,
			explain: "ステレグシュチイ級フリゲート",
			modelName: "ステレグシュチイ級フリゲート",
			performance: {
				power: 80,
				fire: 120,
				rotation: 20,
				rising: 0
			}
		},
		zero_fighter: {
			type: Ocean.ModelTypes.plane,
			path: "./objs/zero_fighter/scene.json",
			nationality: Ocean.nationalityList.Japan,
			explain: "零戦",
			modelName: "零戦",
			performance: {
				power: 100,
				fire: 50,
				rotation: 30,
				rising: 120
			}
		},
		p51_mustang: {
			type: Ocean.ModelTypes.plane,
			path: "./objs/p51_mustang/scene.json",
			nationality: Ocean.nationalityList.America,
			explain: "P51 マスタング",
			modelName: "P51 マスタング",
			performance: {
				power: 60,
				fire: 50,
				rotation: 100,
				rising: 80
			}		
		},
		hawker_tempest: {
			type: Ocean.ModelTypes.plane,
			path: "./objs/hawker_tempest_simple/scene.json",
			nationality: Ocean.nationalityList.Britain,
			explain: "ホーカー テンペスト",
			modelName: "ホーカー テンペスト",
			performance: {
				power: 90,
				fire: 80,
				rotation: 80,
				rising: 70
			}		
		}

	};

	// プレーヤの状態
	Ocean.GameStatus = {
		Loading: 1,
		Ready: 2,
		PLaying : 3,
		Pause : 4,
		Win : 5,
		GameOver: 6
	}

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

		"beShot": function(senderId, instanceId, point, shooterObjId){
			let fighter = fighterInstances[instanceId];
			if(fighter && fighter.mesh){
				console.log("func beshot!!");
				beShotFighter(instanceId, point, shooterObjId);
			}
		}


	};

	// type = func でpublish
	Ocean.prototype.publishFunc = function(funcName, _userId){
		let sliced = Array.prototype.slice.call(arguments, 2);
		console.log(sliced);
		let msgObj = {
			type: ChannelMsgTypes.Func,
			funcName: funcName,
			args: sliced // 2番目以降取得
		}
    	sendDataChannel(msgObj, _userId);
    	console.log("publish func");
    	console.log(msgObj);
	}

	// start ボタンを押す
	// このタイミングでスマホ用にaudioを流す
	// TODO 
	Ocean.prototype.OnClickStart = function(bgm){
		audioController.onClickInitialize(bgm);
		//window.scrollTo(200,200);
		setFullScreen(setScreenSize, setScreenSize, function(){console.log("cannnot use full screen");});
		//window.scrollTo(0,1);
	};


	// hash でうけとった戦闘機データを追加する
	// ここで識別するためのid とchanel のid は別にするかも
	/*
		fighterData {
			scale: [],
			rot: [],
			pos: []
			modelName: "",
			meshModelName: "", (option meshとpublishする名前を変更する)
		}
	*/
	Ocean.prototype.addFighter = function(fighterData, instanceId, isMine = false){
		let modelName = fighterData.modelName;
		let meshModelName = fighterData.meshModelName || modelName;
		let model = Ocean.Models[meshModelName];
		if(!model){
			return 0;
		}

		let mesh = model.meshPool.instantiate(instanceId, false);
		let targetMesh = setMesh(mesh, fighterData);
		model.meshPool.parentObj.add(targetMesh);

		let performance = model.performance;
		let horizontalCoefficient = performance  
									? HORIZONTAL_COEFFICIENT_BASE * performance.rotation /100.0
									: HORIZONTAL_COEFFICIENT_BASE;
		let verticalCoefficient = performance 
									? VERTICAL_COEFFICIENT_BASE * performance.rising /100.0
									: VERTICAL_COEFFICIENT_BASE;

		let velocity = fighterData.vel 
						? new THREE.Vector3(fighterData.vel.x, fighterData.vel.y, fighterData.vel.z) 
						: null;

		fighterInstances[instanceId] = {
			modelName: modelName,
			model: model,
			mesh: targetMesh,
			vel: fighterData.vel ? new THREE.Vector3(fighterData.vel.x, fighterData.vel.y, fighterData.vel.z) : velocity,
			angVel : fighterData.angVel ? new THREE.Vector3(fighterData.angVel.x, fighterData.angVel.y, fighterData.angVel.z) : null,
			userId: isMine ? myId : fighterData.userId,
			nonCollision: fighterData.nonCollision ? true : false,
			life: fighterData.life,
			fires: [], // fireGroup
			verticalCoefficient: verticalCoefficient,
			horizontalCoefficient: horizontalCoefficient,
			isPrivate : fighterData.isPrivate ? true : false
		};	
	};

	function setMesh(mesh, fighterData){
		if(fighterData.scale){
			mesh.scale.set(fighterData.scale[0], fighterData.scale[1], fighterData.scale[2]);
		} else {
			mesh.scale.set(10, 10, 10);
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
			//mesh.scale.set(fighterData.scale[0], fighterData.scale[1], fighterData.scale[2]);
			mesh.scale.set(100, 100, 100);
			//console.log(mesh.scale);
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
		for(let index in bulletData.bulletList){
			let bulletObj = bulletData.bulletList[index];
        	if(bulletObj.life <= 0){
        		continue;
        	}
        	bulletObj.mesh.position.x += bulletObj.vel.x * deltaTime;
        	bulletObj.mesh.position.y += bulletObj.vel.y * deltaTime;
        	bulletObj.mesh.position.z += bulletObj.vel.z * deltaTime;
        	bulletObj.life-= deltaTime;

        	// bulletはpool しておき、sceneからは消さない
        	if(bulletObj.life <= 0){

        		// 当たった場合は対象の被弾処理する
        		// TODO 自分が発射した弾のみpublishする　
        		if(bulletObj.beShotObjId){
        			
					Instance.publishFunc("beShot", 0, bulletObj.beShotObjId, bulletObj.point, bulletObj.shooterObjId);
        			if(beShotFighter(bulletObj.beShotObjId, bulletObj.point, bulletObj.shooterObjId)){
        				// score
        				let fighter = fighterInstances[bulletObj.beShotObjId];
        				myScorePoint += fighter.gettableScorePoint || 10;
        			}

        		}
        		bulletData.meshPool.release(bulletObj.mesh);
        		bulletData.bulletList.splice(index ,1); // 残しておいた方がはやいかも
        	}
        }
    }

    // mesh 更新
	Ocean.prototype.updateFighter = function(fighterData, instanceId){
		let fighter = fighterInstances[instanceId];
		if(!fighter)
			return;
		if(fighter.mesh){
			updateMesh(fighter.mesh, fighterData);
		}
		
		if(fighterData.vel){
			fighter.vel = new THREE.Vector3(
				fighterData.vel[0],
				fighterData.vel[1],
				fighterData.vel[2]);
		}

		if(fighterData.angVel){
			fighter.angVel = new THREE.Vector3(
				fighterData.angVel.x,
				fighterData.angVel.y,
				fighterData.angVel.z);
		}

		if(fighterData.life){
			fighter.life = fighterData.life;
		}

		if(fighterData.hasOwnProperty("isPrivate"))
			fighter.isPrivate = fighterData.isPrivate;

		onceLog.log("updateFigher", fighterData, 30);
	}

	// meshを作成し、chanelに情報を流す
	Ocean.prototype.createFighter = function(fighterData){
		let instanceId = uuid();
		fighterData.life = fighterData.life || INITIAL_LIFE;
		this.addFighter(fighterData, instanceId);
		if(isUseChanel){
			fighterInstances[instanceId].userId = chanelControl.getMyId();
			console.log(chanelControl.getMyId());
			publishObj(instanceId);
		}
		
		return instanceId;
	};

	Ocean.prototype.deleteFighter = function(instanceId){
		// fire 削除
		for(let fire of fighterInstances[instanceId].fires)
		{
			firePool.release(fire);
		}

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

	Ocean.prototype.applyPerformanceVelocity = function(instanceId){
		let fighter = fighterInstances[instanceId];
		if(!fighter)
			return;

		let modelName = fighter.modelName;
		let model = Ocean.Models[modelName];
		let performance = model.performance;
		fighter.vel = new THREE.Vector3(0, 0, POWER_VELOCITY_COEFFICIENT * performance.power);
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

		if(this.gameStatus == Ocean.GameStatus.GameOver)
			return;

		if(control.debugPause){
			audioController.pauseBgm();
			this.gameStatus = Ocean.GameStatus.Pause;
			return;
		}
		this.gameStatus = Ocean.GameStatus.play;

		
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

		let rotatedVertical = (new THREE.Vector2(horizontalVel, verticalVel)).rotateAround(zeroVec2,  control.vertical * fighter.verticalCoefficient);
		let rotatedHorizontal = (new THREE.Vector2( vel.z, vel.x)).rotateAround(zeroVec2, - control.horizontal* fighter.horizontalCoefficient); 
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
		// randomなふらつき
		if(this.fpsManager.get() > 40){
			let randomVibration = new THREE.Vector3(Math.random()*2 -1, Math.random()*2 -1, Math.random()*2 -1); 
			randomVibration.multiplyScalar(randomVibrationCoefficient);
			deletaPos.add(randomVibration);
		}
		fighter.mesh.position.add(deletaPos);

		let limit = 20;
		if(fighter.mesh.position.y < limit){
			fighter.mesh.position.y = limit
		}

		if(meterControllers){
			meterControllers.compass.rotatePoint(beta/Math.PI*180);
			meterControllers.feet.rotatePoint(fighter.mesh.position.y /100);
		}
	
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
		Serialize
		oceanで使用するデータ(fighterInstances) と　chanelで持っているデータは別形式。
		chanelで持つデータ形式ではmeshやdomオブジェクトをもたない
		
	*/
	function getObjHash(instance, instanceId){
		let mesh = instance.mesh;
		if(!mesh)
			return {};
		
		return {
			id: instanceId,
			userId: instance.userId,
			modelName: instance.modelName,
			scale: [mesh.scale.x, mesh.scale.y.floatFormat(3), mesh.scale.z.floatFormat(3)],
			rot: [mesh.rotation.x.floatFormat(3), mesh.rotation.y.floatFormat(3), mesh.rotation.z.floatFormat(3)],
			pos: [mesh.position.x.floatFormat(0), mesh.position.y.floatFormat(0), mesh.position.z.floatFormat(0)],
			life: instance.life
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
		let point = {
		};
		let directon = fighter.vel.clone().normalize();
		let ray = new THREE.Raycaster(clonebullet.position, directon);
		let beShotObjId;
        let objs = ray.intersectObjects( fighterGroup.children, true);
    	if(objs.length > 0){
    		let obj = objs[0];
    		let dist = obj.distance;
    		console.log(dist);
    		life = dist/bulletSpeed;
    		point = obj.point;
    		console.log(life);
    		beShotObjId = getInstanceIdFromMeshRecursively(obj.object);
    	}

		let bulletObj = {
			mesh: clonebullet,
			vel: fighter.vel.clone().normalize().multiplyScalar(bulletSpeed),
			life: life,
			point: point,
			beShotObjId : beShotObjId, // 被弾するオブジェクト
			shooterObjId : fighterInstanceId
		};
		bulletData.bulletList.push(bulletObj);
	}

 	Ocean.prototype.setOrbitControl = function(_isOrbitControl, fighterInstanceId){
 	//	isOrbitControl = _isOrbitControl ? true : false;
 		if(_isOrbitControl)
 		{
 			let fighter = fighterInstances[fighterInstanceId];
 			if(!fighter)
 				return;

 			controls = new THREE.OrbitControls( fighter.mesh, renderer.domElement );
			controls.enablePan = false;
			controls.minDistance = 100.0;
			controls.maxDistance = 500.0;
			controls.maxPolarAngle = Math.PI * 0.495;
			controls.target.set( fighter.mesh.position.x, fighter.mesh.position.y, fighter.mesh.position.z);

 		}
 	}

 	let objectControl;
 	Ocean.prototype.setObjectControl = function(isControl, fighterInstanceId, domElement){
		if(isControl)
		{
			let fighter = fighterInstances[fighterInstanceId];
 			if(!fighter)
 				return;
			objectControl = new THREE.TrackObjectControls(fighter.mesh, camera, domElement);
			objectControl.inverseXY = isInverseScreen;
		}
		else 
		{
			objectControl.enabled = false;
		}

		return objectControl;
	}


	// getter
	Object.defineProperty(Ocean.prototype, "myScorePoint", {
    	get: function(){
        	return myScorePoint;
    	}
    });

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
		let ids = [];
		for (let i in fighterInstances)
		{
			if(!fighterInstances[i].isPrivate)
				ids.push[i];
		}
		publishObjs(ids, _userId);
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
	// channel経由でも呼ばれる
	function beShotFighter(instanceId, point, shooterObjId){
		let fighter = fighterInstances[instanceId];
		let shooterObj = fighterInstances[shooterObjId];

		if(!fighter || fighter.life <= 0 || !shooterObj)
			return false;

		if(fighter.life > 0)
			audioController.play("explosion_audio");
		else
			audioController.play("explosion_long_audio");
        console.log("beshot!!");

		//audioController.play("explosion_audio");
		let isMe = instanceId == controlFighterId;

		fighter.life -= shooterObj.model.performance.fire;
		console.log(fighter.life);
		if(fighter.life <= 0)
		{
			if(isMe)
				Instance.gameStatus = Ocean.GameStatus.GameOver;
			else
			{
				if(fighter.vel)
					fighter.vel.y = - 100;
				else 
					fighter.vel = new THREE.Vector3(0, -100, 0);
			}
			//	Instance.deleteFighter(instanceId);
		} 
		else  
		{
			if(!isMe && Instance.fpsManager.get() > 30){
				createFire(instanceId, point );
			}

		}

		// life-gauge
		if(isMe && meterControllers)
			meterControllers.life_gauge.setGauge(fighter.life);
		console.log("beshot isme" + isMe);

		beShotCallback(isMe, instanceId, fighter.life);
		return true;
		//fighter.userId 
	}
	/* 敵機示唆 
		毎ループよぶこと
	*/
	let EnemyPointer = (function(){

		const blinkInterval = 0.5 ; //(s)
		const distanceLimit = 30000;
		const viewAngleDeg = cameraParams.fov *Math.PI / 180; // 


		let $pointerParentDom, $pointerDom;
		let parentDomHeight, parentDomWidth;
		let cachedMyFighterInstance;


		// contructor
		function EnemyPointer(_$pointerParentDom, _$pointerDom){
			this.loopCount = 0;
			this.loopCountMax = 0;
			this.updateMaxCount();
			this.isShow = false;
			$pointerParentDom = _$pointerParentDom;
			
			$pointerDom = _$pointerDom;
			this.pointerDomList = {};
		}

		EnemyPointer.prototype.updateMaxCount = function(){
			if(deltaTime && deltaTime > 0){
				this.loopCountMax = Math.floor(blinkInterval/deltaTime);
			}else{
				this.loopCountMax = blinkInterval*60;
			}
		}	

		// 毎フレーム呼ぶこと
		EnemyPointer.prototype.loop = function(){
			this.loopCount++;
			if(this.loopCount < this.loopCountMax)
				return;
			this.loopCount = 0;
			this.updateMaxCount();
			this._update();
		}

		EnemyPointer.prototype.createPointer = function(fighterId){
			let $newPointer = $pointerDom.clone();
			this.pointerDomList[fighterId] = $newPointer;
			$pointerParentDom.append($newPointer);
			return $newPointer;
		}

		EnemyPointer.prototype.deletePointer = function(fighterId){
			let $pointer = this.pointerDomList[fighterId];
			if(!$pointer)
				return;
			$pointer.remove();
			delete this.pointerDomList[fighterId];
		}

		/*
		 ここがこのクラスの肝
		 毎フレーム実行するわけではないので多少重くてもよしとする
		 */
		EnemyPointer.prototype.updatePointer = function($pointer, fighterInstance, fighterId, myUp, myForward){
			if(!cachedMyFighterInstance.mesh || !fighterInstance.mesh)
			{
				this.deletePointer(fighterId);
				return false;
			}

			let myFighterPos = cachedMyFighterInstance.mesh.position;
			let enemyPos = fighterInstance.mesh.position;
			let distance = myFighterPos.distanceTo(enemyPos);
			if(distance > distanceLimit){
				this.deletePointer(fighterId);
				return false;
			}

			
			let subVec = enemyPos.clone().sub(myFighterPos);
			let h = myUp.dot(subVec);
			let holSubVec = subVec.sub(myUp.clone().multiplyScalar(h));
			let holDirectionVec = holSubVec.clone().normalize();
			let holDot = myForward.dot(holDirectionVec); // 平面での前方向1~0(localX方向の画角のsin)
			let holCross = holDirectionVec.clone().cross(myForward); //myForward.clone().cross(holDirectionVec);
			let angle = Math.asin(holCross.dot(myUp)); // -pi/2 ~ pi/2

			
			// pi ~ -PI にするために場合分け
			if(holDot < 0){
				if(angle>0)
					angle = Math.PI - angle;
				else
					angle = - Math.PI - angle;
			}

			let cylinderRad = holSubVec.dot(holDirectionVec);
			let w = angle*cylinderRad;

			let elevationAngle = 0.0;
			if(distance>0)
				elevationAngle = Math.asin(h/distance);//仰角のsin

			// 画角内
			if(Math.abs(angle) < viewAngleDeg && Math.abs(elevationAngle) < viewAngleDeg){
				this.deletePointer(fighterId);
				return false;		
			}


			let len = Math.sqrt(w*w + h*h);
			let left = (1 + w/len ) * parentDomWidth/2;
			let top = (1 - h/len ) * parentDomHeight/2;

			let atan = -Math.atan2(h,w) - Math.PI/2;
			
			let deg = atan*180.0/Math.PI;
			
			if(!$pointer)
				$pointer = this.createPointer(fighterId);
			$pointer.css("left", left + "px").css("top", top + "px").css("transform", `rotate(${deg}deg)`);
			if(this.isShow)
				$pointer.show();
			return true;
		}

		EnemyPointer.prototype._update = function(){
			if(!cachedMyFighterInstance){
				cachedMyFighterInstance = fighterInstances[controlFighterId];
				if(!cachedMyFighterInstance)
					return;
			}
			if(!parentDomHeight){
				parentDomWidth = $pointerParentDom.width();
				parentDomHeight = $pointerParentDom.height();
				console.log(parentDomHeight);
				console.log(parentDomWidth);
			}
			

			if(this.isShow){
				this.isShow = false;
				this.hideAll();
			}else{
				this.isShow = true;
				let myUp = cachedMyFighterInstance.mesh.up;
				let myForward = cachedMyFighterInstance.vel.clone().normalize(); // fixme これしかないのか？
				for(let fighterId in fighterInstances){
					let fighterInstance = fighterInstances[fighterId];
					if(fighterInstance && fighterId != controlFighterId){
						let $pointer = this.pointerDomList[fighterId];		
						this.updatePointer($pointer, fighterInstance, fighterId, myUp, myForward);
					}
				}
			}
		}

		EnemyPointer.prototype._lambdaFunc = function(func){
			for(let index in this.pointerDomList){
				let $pointer = this.pointerDomList[index];
				if($pointer){
					func($pointer, index);
				}
			}
		}

		EnemyPointer.prototype.hideAll = function(){
			this._lambdaFunc(function($pointer){
				$pointer.hide();
			});
		}

		EnemyPointer.prototype.showAll = function(){
			this._lambdaFunc(function($pointer){
				$pointer.show();
			});
		}

		return EnemyPointer;
	})();

	function createFire(fighterId, point){
		let fighter = fighterInstances[fighterId];
		if(!fighter)
			return;

		let fire = firePool.instantiate(point);

		fire.offsetFromFighter = new THREE.Vector3(
			point.x - fighter.mesh.position.x,
			point.y - fighter.mesh.position.y,
			point.z - fighter.mesh.position.z
		);

		fighter.fires.push(fire);
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

	//  fire pool
	let FirePool = (function(){

		function FirePool(parentObj){
			this.parentObj =  parentObj;
			this.poolList = [];
		}
		
		FirePool.prototype.instantiate = function(point){
			point = point || new THREE.Vector3(0,0,0);
			let fire;
			if(this.poolList.length > 0){
				fire = this.poolList.shift();
				fire.mesh.visible = true;
			} 
			else 
			{
				let fireWidth  = 10;
				let fireHeight = 20;
				let fireDepth  = 10;
				let sliceSpacing = 0.5;

				fire = new VolumetricFire(
					fireWidth,
					fireHeight,
					fireDepth,
					sliceSpacing,
					camera
				);
				console.log("fire!!");
				console.log(point);
				console.log(this.parentObj);
			}
			fire.mesh.position.set(point.x, point.y, point.z);
			fire.mesh.scale.set(10,10,10);

			if(this.parentObj)
				this.parentObj.add(fire.mesh);

			return fire;
		};


		FirePool.prototype.release = function(fire){
			if(this.parentObj)
				this.parentObj.remove(fire);
			fire.mesh.visible = false;
			this.poolList.push(fire);
		}

		return FirePool;
	})();

	return Ocean;
//}	
})();

