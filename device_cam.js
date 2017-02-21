var camera_controller = (function(){
	var cameraData = [];
	var cam_id = 1;
	var cameraData = [];
	var localStream;
	var video;
	var camera_controller = function(videoElement){
		video = videoElement;
	}

	camera_controller.prototype.startCamera = function(_cam_id = 1){
		cam_id = _cam_id;
		if(!!MediaStreamTrack.getSources){
			MediaStreamTrack.getSources(function(data){
	            //カメラ情報を取得して、出力する
	            var strCamera = "";
	            var len = data.length;
	            for( var i = 0 ; i < len ; i ++ ){
	            	strCamera += "<p>種類："+ data[i].kind+"<br/>ID："+ data[i].id+"</p>";
	            	if( data[i].kind == "video" ){
	            		cameraData.push(data[i]);
	            	}
	            }
	            if( cameraData.length == 0 ){
	            	alert("カメラが見つかりません");
	            	return;
	            }
	            //カメラを取得・切り替える
	            setCamera();
	            console.log(cameraData);
	            console.log(strCamera);
	        });
        }else if(!!navigator.mediaDevices.enumerateDevices){
          	navigator.mediaDevices.enumerateDevices()
          	.then(function(devices) {
            	devices.forEach(function(device) {
              		console.log(device.kind + ": " + device.label +
                          " id = " + device.deviceId);
              		if(device.kind === "videoinput"){
              			cameraData.push({id:device.deviceId});
              		}
            	});
            	console.log(cameraData);
            	setCamera();
          	})
          	.catch(function(err) {
           		console.log(err.name + ": " + error.message);
          	});
        }else{
        	//カメラを取得・切り替える
        	setCamera();   
        }
	}

	camera_controller.prototype.convertCamera = function(){
		cam_id++;
		if(cam_id == cameraData.length){
			cam_id = 0;
		}
		setCamera();
	}

	var setCamera = function(){
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;
        window.URL = window.URL || window.webkitURL;
		 //カメラ再生中の場合は切り替えのため、一旦停止する
        if( localStream ){
          localStream.getTracks().forEach(function (track) { track.stop()});
        }

        if(cameraData.length > 0){
        	if(cam_id > cameraData.length-1){
        		cam_id = 0;
        	}
        	var constraints = {
        		video: {
        			optional: [{sourceId: cameraData[cam_id].id }] //カメラIDを直接指定する
        		},
        		audio: false
          	};
        }else{
        	var constraints = {video: true, audio: false};
        }
        //カメラをIDを使用して取得する
        navigator.getUserMedia(
        	constraints,
        	function(stream) {

        		//切り替え時にカメラを停止するため、情報を保存しておく
        		localStream = stream;
	            //カメラをvideoに結びつける
    	        video.src = window.URL.createObjectURL(stream);
	        },
          	function(err) {
            	//エラー処理
          	}
        );
	}
	return camera_controller; 
})();