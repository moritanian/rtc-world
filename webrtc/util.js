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

