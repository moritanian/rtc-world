  $(function(){

    //カメラの情報を取得
    var video, canvas, ctx;
    var effect_index = 0;
    var filters = ["", "grayscale", "sepia", "blur"];
    var isRecording = false;
    var isShowMpDialog = false;
    
    video = $("#myVideo").get(0);
    var camController = new camera_controller(video, camera_controller.RESOLUTION.HD);
    camController.startCamera();

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

        $(video).hide();
        $(canvas).show();
        setInterval(function(){
          $(video).show();
          $(canvas).hide();
        }, 2000);
        console.log(video.videoHeight);
        console.log(video.videoWidth);
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

      function readyPlaybackRecorded(){
    
        let blobUrl = camController.getRecordedBlobUrl(); 
        let playbackVideo = video;
        if (playbackVideo.src) {
          window.URL.revokeObjectURL(playbackVideo.src); // 解放
          playbackVideo.src = null;
        }
        playbackVideo.src = blobUrl;
        playbackVideo.pause();

      }

      function downloadRecorderd(){
        var url = camController.getRecordedBlobUrl();
        var d = new Date();
        var u_time = Math.floor((d.getTime())/1000);
        var filename = "lucky_photo_movie" + u_time + ".webm";
        download(url, filename);
      }

      $("#myVideo").bind("click", function(){
        if(isShowMpDialog){
          video.play();
        } else if(!isRecording){
          takeCamera();
        }
      });

      //カメラ切り替えボタンクリックイベント
      $("#changeButton").bind("click",function(){
        camController.convertCamera();
      });

      $("#takeButton").bind("click", function(){
        takeCamera();
      });

      $("#movieButton").bind("click",function(){
        if(isRecording){
          isRecording = false;
          camController.stopRecording();
          readyPlaybackRecorded();
          $(this).removeClass("recording");
          $("#mp-dialog").show();
          isShowMpDialog = true;
        } else {
          isRecording = true;
          camController.startRecording();
          $(this).addClass("recording");
          
        }
      });

      $("#effectButton").bind("click",function(){
        applyEffect();
      });

      $("#playbackButton").bind("click", function(){
        video.play();
      });

      $("#movieDownloadButton").bind("click", function(){
        downloadRecorderd();
      });

      $("#closeMpButton").bind("click", function(){
        $("#mp-dialog").hide();
        isShowMpDialog = false;
        camController.startCamera();
      });

      canvas = $("#canvas");
      $(video).css("max-width", screen.width);
      $(canvas).css("max-width", screen.width);
      $(video).css("max-height", screen.height*0.7);
      $(canvas).css("max-height", screen.height*0.7);
     
      canvas.hide();
      canvas = canvas.get(0);
    });