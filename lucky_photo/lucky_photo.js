  $(function(){

    //カメラの情報を取得
    var video, canvas, ctx;
    var effect_index = 0;
    var filters = ["", "grayscale", "sepia", "blur"];
    
    video = $("#myVideo").get(0);
    var camController = new camera_controller(video);
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
        camController.convertCamera();
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