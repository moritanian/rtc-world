var UniqueIdObjs = (function(){
	var UniqueIdObjs = function(){
		this.objs = {}; // hash にする　キーがユニーキー、　値は　true, false 
						// キーは文字列で保持されることに注意
	};

	UniqueIdObjs.prototype.getIdsList = function(){
		return Object.keys(this.objs);
	};
	
	UniqueIdObjs.prototype.length = function(){
		return this.getIdsList().length;
	};

	UniqueIdObjs.prototype.isExistingId = function(id){
		return this.objs[id] ? true : false;
	};

	UniqueIdObjs.prototype.addNewObj = function(objInfo){
		let id = this.getNewId();
		this.ids[id] = objInfo;
		return id;
	};

	UniqueIdObjs.prototype.updateObj = function(id, objInfo){
		this.objs[id] = objInfo;
	}

	UniqueIdObjs.prototype.deleteObj = function(id){
		delete this.objs[id];
	};

	UniqueIdObjs.prototype.getNewId = function(){
		return uuid();
	};

	return UniqueIdObjs;
})();
/*
	 webRTCのユーザ管理と流すobjデータの管理
	 ユーザ管理
	 	繋がったユーザに対して重複なくユーザidを割りふる
	 
	 objデータ管理
		外から受け取った新規objを内部hashにもち、chanelに流し、instanceId返却
		外から受け取ったobj更新データを内部hashに反映、chanelに流す
			内部でもつのはidリストのみ？？ <=　外部から受け取ったobj　+ chanel経由obj
		chanel経由で受け取ったobjデータから外部で定義したコールバックを呼ぶ
		
*/
var ChanelControl = (function(){

	let userId = 1;
	let limitUserNum = 4;
	let chanel;
	let connectionChangedFunc;
	let objs = new UniqueIdObjs();
	let isGotWorldInfo = false;
	let sendMyEnterFlag = false;
	let members = {}; //キーをuser_id に
	let memberNum = 1;
	let isParentUser = true;
	let requireGetWorldAnsNum;
	let startTime, elapsedTime;

	let objInfoCallback;

	const msgTypes = {
		objsInfo : "objs_info",
		objsAllInfo : "objs_all_info",
		enter: "enter"
	};


	// constructor
	var ChanelControl = function(chanelName, obj_info_callback, option){

		// read option data
		limitUserNum = option.limitUserNum || limitUserNum;
		connection_changed_func = option.connection_changed_func;
		objInfoCallback = obj_info_callback;

		startTime = getTime();
		/* 
			chanel へ渡す
			call back 
		*/

		// 接続開始
		var connected_callback = function(connectionCount){
			memberNum = connectionCount + 1;
			if(!isGotWorldInfo && !sendMyEnterFlag){ // 初めての dataChanelのコネクション完了時
				requirGetWorldAnsNum = memberNum -1;
				this.sendMyEnterFlag = true;
				sendMyEnterInfo();	 // 1回だけで帰ってこなければ誰もいないということで
			}
            if(connectionChangedFunc){
            	connectionChangedFunc(memberNum);
            }
        };

        // めーっせーじ受信
        var msg_get_callback = function(msg){
            var msgObj = JSON.parse(msg);
            console.log(msgObj);
			if(msgObj.type === msgTypes.objsInfo || msgObj.type === msgTypes.objsAllInfo ){ //追加するobj情報// 参加者への初期情報もこれで伝える
				for(var objId in msgObj.objs){
					if(objs.isExistingId(objId)){ // 存在する場合は更新
						objs.updateObj(objId, msgObj.objs[objId]);
					 	objInfoCallback(objId, msgObj.objs[objId], /* is_new = */ false);
					}else{ // ない場合は追加
						objs.updateObj(objId, msgObj.objs[objId]);
						objInfoCallback(objId,  msgObj.objs[objId], /* is_new = */ true);
					}
				}
				if(msgObj.type === msgTypes.objsAllInfo && isGotWorldInfo == false){
					requireGetWorldAnsNum --;
					console.log("require " + requireGetWorldAnsNum );
					console.log("id " + msgObj.user_id);
					members[msgObj.user_id] = "connected";
					if(requireGetWorldAnsNum == 0){
						isGotWorldInfo = true;
						// TDOD ここ制限できていない ただ、上限以降は同じid振られる
						for(var user_id = 1; user_id < limitUserNum; user_id++){
							console.log(user_id);
							console.log(members[user_id]);
							if(!(members[user_id] === "connected")){
								this.setUserId(user_id);
								break;
							}
						}
						console.log("set user id" + this.user_id);
						console.log(members);
					}
				}
			}else if(msgObj.type === msgTypes.enter){ // 新規加入者がはいってきた
				console.log("get msg enter");
				//console.log("time stamp me: " + this.start_time + "other" + msg_obj.start_time);
				if(!isGotWorldInfo  &&  msgObj.elapsedTime <  elapsedTime){ // この時、他からデータをもらってない場合、自分がfirst user　ただし、最初の二人の接続は開始時間で比べる
					isGotWorldInfo = true;
					setUserId(1);
					console.log("set user id parent");

				}
				if(isParentUser){
					console.log("send obj info first");
					sendObjInfo();
				}
			}
        };

        // 接続終了
        var closed_callback = function(connectionCount){
            console.log("connection closed callback" + connectionCount);
            memberNum = connectionCount + 1;
            if(connectionChangedFunc){
            	connectionChangedFunc(memberNum);
            }
        }
		chanel = new Chanel(connected_callback, msg_get_callback, closed_callback, chanelName);
	};

	// こちらで新規追加し、publishする
	ChanelControl.prototype.addNewObj = function(objInfo){
		let objId = objs.addNewObj(objInfo);
		sendObjInfo(id);
		return objId;
	}

	// こちらで更新してpublishする
	ChanelControl.prototype.updateObj = function(objInfo, id){
		console.log(objInfo);
		objs.updateObj(id, objInfo);
		sendObjInfo(id);
	}

	ChanelControl.prototype.getUserId = function(){
		return userId;
	};

	// setter はprivate
	function setUserId(user_id){
		userId = user_id;
	}


	function sendMyEnterInfo(){
		let crtTime = getTime();
		elapsedTime = crtTime - startTime;
		let msgObj = {type: msgTypes.enter, startTime: startTime, elapsedTime: elapsedTime};
		chanel.sendAlongDataChanel(JSON.stringify(msgObj));
		console.log("my enter");
		console.log(msgObj);
	};

	function sendObjInfo(objId) {
		var msgObj = {};
		msgObj.objs = {};
		if(objId){
			msgObj.type = msgTypes.objsInfo;
			msgObj.objs[objId] = objs.objs[objId];
		}else{
			msgObj.type = msgTypes.objsAllInfo;
			msgObj.objs = objs.objs;
			msgObj.user_id = this.user_id;
		}
		var jsonObj = JSON.stringify(msgObj);
		chanel.sendAlongDataChanel(jsonObj);
	}

	return ChanelControl;
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