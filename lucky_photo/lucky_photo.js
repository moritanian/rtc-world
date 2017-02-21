  $(function(){

      //カメラの情報を取得
      var cameraData = [];
      var video, canvas, ctx;
      var has_media_stream_track = true;
      var effect_index = 0;
      var filters = ["", "grayscale", "sepia", "blur"];
      try{
        console.log(MediaStreamTrack);
        console.log(!!MediaStreamTrack.getSources);
        console.log(!!navigator.mediaDevices.enumerateDevices);

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
                cameraData.push(device);
              }
            });
            console.log(cameraData);
          })
          .catch(function(err) {
            console.log(err.name + ": " + error.message);
          });
        }else{
          has_media_stream_track = false;
          //カメラを取得・切り替える
          setCamera();   
        }
      }catch(e){
        console.log(e);
        has_media_stream_track = false;
        //カメラを取得・切り替える
        setCamera();
      }
    

      //カメラを取得・切り替える
      var cnt = 0;
      var localStream = null;
      function setCamera(){

        //カメラを順番に切り替える
        cnt++;
        if( cnt == cameraData.length ){
          cnt = 0;
        }

        //カメラ取得
        video = document.getElementById('myVideo');

        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;
        window.URL = window.URL || window.webkitURL;

        //カメラ再生中の場合は切り替えのため、一旦停止する
        if( localStream ){
          localStream.getTracks().forEach(function (track) { track.stop()});
        }

        if(has_media_stream_track){
          var constraints = {
            video: {
              optional: [{sourceId: cameraData[cnt].id }] //カメラIDを直接指定する
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
            if(has_media_stream_track){
              $("#result_use").html( cameraData[cnt].id );
            }
            //カメラをvideoに結びつける
            video.src = window.URL.createObjectURL(stream);

          },
          function(err) {
            //エラー処理
          }
        );

      }

      function takeCamera(){
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgb(0,255,0)";
        ctx.strokeStyle = "rgb(0,255,0)";
        ctx.drawImage(video, 0, 0);
        //var url = canvas.toDataURL('image/webp');
        var url = canvas.toDataURL();
        var d = new Date();
        var u_time = Math.floor((d.getTime())/1000);
        var filename = "lucky_photo" + u_time + ".png";
        download(url, filename);
      }

      function download(objectURL, filename) {
        var a = document.createElement('a');
        var e = document.createEvent('MouseEvent');
        //console.log(objectURL);

        //a要素のdownload属性にファイル名を設定
        a.download = filename;
        a.href = objectURL;

        //clickイベントを着火
        e.initEvent("click", true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(e);

        $(video).hide();
        $(canvas).show();
        setInterval(function(){
          $(video).show();
          $(canvas).hide();
        }, 2000);
      }

      function applyEffect(){
        $(video).removeClass(filters[effect_index]);
        $(canvas).removeClass(filters[effect_index]);
        effect_index ++;
        if(effect_index == filters.length){
          effect_index = 0;
        }
        $(video).addClass(filters[effect_index]);
        $(canvas).addClass(filters[effect_index]);
        console.log(filters[effect_index]);
      }

      //カメラ切り替えボタンクリックイベント
      $("#changeButton").bind("click",function(){
        setCamera();
      });

      $("#takeButton").bind("click", function(){
        takeCamera();
      });

      $("#effectButton").bind("click",function(){
        applyEffect();
      });

      canvas = $("#canvas")
      $(video).css("max-width", screen.width);
      $(canvas).css("max-width", screen.width);
      $(video).css("max-height", screen.height*0.7);
      $(canvas).css("max-height", screen.height*0.7);
     
      canvas.hide();
      canvas = canvas.get(0);


     


    });