// 一度だけ出したいログ
var OnceLog = (function(){
	var OnceLog = function(){
		this.logHash = {};
	};

	OnceLog.prototype.log = function(key, str, count = 1){
		if(this.logHash[key] == null || this.logHash[key] > 0){
			if(this.logHash[key] != null){
				count = this.logHash[key];
			}
			this.logHash[key] = count -1;
			console.log(key);
			console.log(str);
		}
	}
	return OnceLog;
})();

// 一度だけ出したいログ
var MeshPool = (function(){
	var MeshPool = function(originalMesh, parentObj){
		this.originalMesh = originalMesh;
		this.poolList = [];
		this.parentObj = parentObj;
	};

	// meshを返す
	// poolされているものはpoolListから外す
	MeshPool.prototype.instantiate = function(instanceId, addScene = true){
		if(!this.originalMesh)
			return null;
		let mesh;
		if(this.poolList.length>0){
			mesh =  this.poolList.shift();	
			mesh.visible = true;
		} else {
			mesh = this.originalMesh.clone();
		}

		mesh.instanceId = instanceId;
		
		if(addScene && this.parentObj){
			this.parentObj.add(mesh);
		}
		return mesh;
	}

	MeshPool.prototype.release = function(mesh){
		mesh.visible = false;
		if(this.parentObj)
			this.parentObj.remove(mesh);
		this.poolList.push(mesh);
	}

	return MeshPool;
})();

var LpFilter = (function(){
    var LpFilter = function(ratio = 0.1){
        this.data = 0;
        this.ratio = ratio;
    }
    LpFilter.prototype.set = function(new_data){
        this.data = this.data*(1 - this.ratio) + new_data * this.ratio; 
    }
    LpFilter.prototype.get = function(){
        return this.data;
    }
    return LpFilter
})();


function getTime(){
	var dateObj = new Date();
	return dateObj.getTime();
};

function uuid() {
  var uuid = "", i, random;
  for (i = 0; i < 32; i++) {
    random = Math.random() * 16 | 0;

    if (i == 8 || i == 12 || i == 16 || i == 20) {
      uuid += "-"
    }
    uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
  }
  return uuid;
}


function setFullScreen(startFunc, endFunc, failedFunc, lockMode = "landscape"){
	document.body.requestFullscreen  = document.body.requestFullscreen 
		|| document.body.mozRequestFullScreen
		|| document.body.webkitRequestFullScreen 
		|| document.body.webkitRequestFullscreen 
		|| document.body.msRequestFullscreen;

	let fullScreenChangeList = [
								"fullscreenchange",
								"mozfullscreenchange",
								"webkitfullscreenchange",
								"MSFullscreenchange"
								];

	document.fullscreenEnabled =   document.fullscreenEnabled
		|| document.mozFullScreenEnabled
		|| document.webkitFullscreenEnabled
		|| document.msFullscreenEnabled;

	console.log(document.fullscreenEnabled);

	let fullScreenErrorList =  ["fullscreenerror",
								"webkitfullscreenerror",
								"mozfullscreenerror",
								"MSFullscreenError"]

	//console.log(fullScreenFunc);
//	console.log(fullScreenError);

	document.body.requestFullscreen();
	for(let index in fullScreenChangeList){
		document.addEventListener(fullScreenChangeList[index], function( event ) {
			console.log(document.fullscreenEnabled);
			if(document.fullscreenEnabled)
			{
				console.log("fullscreen enable");
				if(lockMode)
					lockOrientation(lockMode);
				startFunc();
			}
			else
				endFunc();

		});

		document.addEventListener(fullScreenErrorList[index], function(event){
			failedFunc();
		});
	}
}

function lockOrientation(mode) {
	console.log("lockOrientation");
    if (screen.orientation.lock) {
        screen.orientation.lock(mode);
    }
    else if (screen.lockOrientation) {
        screen.lockOrientation(mode);
    }
    else if (screen.webkitLockOrientation) {
    	console.log("lock");
        screen.webkitLockOrientation(mode);
    }
    else if (screen.mozLockOrientation) {
        screen.mozLockOrientation(mode);
    }
    else if (screen.msLockOrientation) {
        screen.msLockOrientation(mode);
    }
}


