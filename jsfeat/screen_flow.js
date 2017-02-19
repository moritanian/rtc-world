var screen_flow = (function() {
//function screen_flow(){
    "use strict";
 
 	var active_num;
 	var predict_flow_vec_accumulated = [0,0,0]; // 予測された移動ベクトル 開始時からの移動
 	var predict_flow_vec_base = [0,0,0]; // baseの予測された移動ベクトル 
    var predict_flow_vec_from_base = [0,0,0]; // base(今のflow点)からの相対的な予測された移動ベクトル
    var is_show_canvas;
    var is_calc_depth = true;
    var render_func; // 描画のタイミングで呼ばれる関数　外部から与えられる
 	var screen_flow = function(REQURE_POINT_NUM_PER_SIDE = 3, debug = false, render){
 		console.log("construction" + REQURE_POINT_NUM_PER_SIDE);
            render_func = render;
            var video = $("<video id='webcam'></video>");
            var canvas = $("<canvas id='canvas'></canvas>");
            $(document.body).append(video);
            $(document.body).append(canvas);
            $(canvas).hide();
            $(video).hide();
            video = video.get(0);
            canvas = canvas.get(0);
            is_show_canvas = false;

            if(debug){
            	var log = $("<div><div id='no_rtc' style='display:none'></div><div id='move'></div><div id='log'></div></div>");
            	$(document.body).append(log);
            }

            var has_media_stream_track = true;
            var cameraData = [];
            function _gotSources(sourceInfos)
            {
              for (var i = 0; i != sourceInfos.length; i++)
              {
                var sourceInfo = sourceInfos[i];
                if (sourceInfo.kind == 'video')
                {
                     cameraData.push(sourceInfos[i]);
                }
              }
              setCamera();
            }

            function setCamera(){
                try{
                    if(has_media_stream_track){
                        var constraints = {
                            video: {
                            optional: [{sourceId: cameraData[1].id}]
                            }
                        };
                    }else{
                        var constraints = {video: true};
                    }
                }catch(e){
                    console.log(e);
                }

                compatibility.getUserMedia(constraints, function(stream) {
                    try {
                        video.src = compatibility.URL.createObjectURL(stream);
                    } catch (error) {
                    	console.log(error);
                        video.src = stream;
                    }
                    setTimeout(function() {
                            video.play();
                        }, 500);
                }, function (error) {
                    $('#log').hide();
                    $('#no_rtc').html('<h4>WebRTC not available.</h4>');
                    $('#no_rtc').show();
                });
            }

            if (typeof MediaStreamTrack === 'undefined')
            {
              alert('未対応ブラウザです');
            }
            else
            {
              try{
                MediaStreamTrack.getSources(_gotSources);
              }
              catch(e){
                console.log(e);
                has_media_stream_track = false;
                setCamera();

              }
            }

            try {
                var attempts = 0;
                var readyListener = function(event) {
                    findVideoSize();
                };
                var findVideoSize = function() {
                    if(video.videoWidth > 0 && video.videoHeight > 0) {
                        video.removeEventListener('loadeddata', readyListener);
                        console.log(video);
                        onDimensionsReady(video.videoWidth, video.videoHeight);
                    } else {
                        if(attempts < 10) {
                            attempts++;
                            setTimeout(findVideoSize, 200);
                        } else {
                            onDimensionsReady(640, 480);
                        }
                    }
                };
                var onDimensionsReady = function(width, height) {
                    demo_app(width, height);
                    window.requestAnimationFrame(tick);
                };

                video.addEventListener('loadeddata', readyListener);
            } catch (error) {
                alert(error);
                $('#log').hide();
                $('#no_rtc').html('<h4>Something goes wrong...</h4>');
                $('#no_rtc').show();
            }

            var stat = new profiler();

            var options,ctx,canvasWidth,canvasHeight;
            var curr_img_pyr, prev_img_pyr, point_count, point_status, prev_xy, curr_xy, base_default_point_xy, c_curr_xy = [];

            var BASE_X_DIST, BASE_Y_DIST; // base点の距離
            // predict_flow_vec_accumulated = predict_flow_vec_base + predict_flow_vec_from_base
            
        

            var move_vec_buff = []; //各点の移動ベクトル(temp)
            var flag = false;

            var demo_opt = function(){
                this.win_size = 20;
                this.max_iterations = 30;
                this.epsilon = 0.01;
                this.min_eigen = 0.001;
            }

            function demo_app(videoWidth, videoHeight) {
                var point_max_num = REQURE_POINT_NUM_PER_SIDE * REQURE_POINT_NUM_PER_SIDE;
                //canvasWidth  = canvas.width;
                //canvasHeight = canvas.height;
                canvasWidth = videoWidth;
                canvasHeight = videoHeight;
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                ctx = canvas.getContext('2d');

                ctx.fillStyle = "rgb(0,255,0)";
                ctx.strokeStyle = "rgb(0,255,0)";

                curr_img_pyr = new jsfeat.pyramid_t(3);
                prev_img_pyr = new jsfeat.pyramid_t(3);
                curr_img_pyr.allocate(videoWidth, videoHeight, jsfeat.U8_t|jsfeat.C1_t);
                prev_img_pyr.allocate(videoWidth, videoHeight, jsfeat.U8_t|jsfeat.C1_t);

                point_count = 0;
                point_status = new Uint8Array(point_max_num); 
                prev_xy = new Float32Array(point_max_num*2);
                curr_xy = new Float32Array(point_max_num*2);

                base_default_point_xy= [];
                BASE_X_DIST = Math.floor(canvasWidth/(REQURE_POINT_NUM_PER_SIDE + 1));
                BASE_Y_DIST = Math.floor(canvasHeight/(REQURE_POINT_NUM_PER_SIDE + 1));
                for(var i=0; i<REQURE_POINT_NUM_PER_SIDE; i++){
                    for(var j=0; j<REQURE_POINT_NUM_PER_SIDE; j++){
                        base_default_point_xy.push((j+1)*BASE_X_DIST);
                        base_default_point_xy.push((i+1)*BASE_Y_DIST);
                        move_vec_buff.push(0);
                        move_vec_buff.push(0);
                    }
                }
                point_count = REQURE_POINT_NUM_PER_SIDE * REQURE_POINT_NUM_PER_SIDE;

                options = new demo_opt();
                stat.add("grayscale");
                stat.add("build image pyramid");
                stat.add("optical flow lk");
            }

            function tick() {
                window.requestAnimationFrame(tick);
                if(render_func){
                    render_func();
                }
                stat.new_frame();
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                   
                   	if(flag){
                    	flag = true;
                    	console.log(video.src);
                    }
                    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
                    var imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

                    // swap flow data
                    var _pt_xy = prev_xy;
                    prev_xy = curr_xy;
                    curr_xy = _pt_xy;
                    var _pyr = prev_img_pyr;
                    prev_img_pyr = curr_img_pyr;
                    curr_img_pyr = _pyr;

                    stat.start("grayscale");
                    jsfeat.imgproc.grayscale(imageData.data, canvasWidth, canvasHeight, curr_img_pyr.data[0]);
                    stat.stop("grayscale");

                    stat.start("build image pyramid");
                    curr_img_pyr.build(curr_img_pyr.data[0], true);
                    stat.stop("build image pyramid");

                    stat.start("optical flow lk");
                    jsfeat.optical_flow_lk.track(prev_img_pyr, curr_img_pyr, prev_xy, curr_xy, point_count, options.win_size|0, options.max_iterations|0, point_status, options.epsilon, options.min_eigen);
                    stat.stop("optical flow lk");

                    //prune_oflow_points(ctx);
                    auto_add_flow_point(ctx);

                  	if(debug){
	                    var text = 'move-x: ' + predict_flow_vec_accumulated[0] + '<br/>move-y: ' + predict_flow_vec_accumulated[1] + '<br/>move-z: ' + predict_flow_vec_accumulated[2]  ;
	                    text += '<br>move-x: ' + predict_flow_vec_base[0] + '<br/>move-y: ' + predict_flow_vec_base[1];
	                    text += '<br>move-x: ' + predict_flow_vec_from_base[0] + '<br/>move-y: ' + predict_flow_vec_from_base[1];
                    	$('#move').html(text);
                        $('#log').html(stat.log() + '<br/>click to add tracking points: ' + active_num);

                    }
                }
            }

             function draw_circle(ctx, x, y) {
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI*2, true);
                ctx.closePath();
                ctx.fill();
            }

            /*
                各点の移動距離計算
                消えた点の追加
                移動量算出 ただし外れ値は除く
                閾値以上の移動の場合、base点の変更
            */

            function auto_add_flow_point(ctx){
                var index = 0;
                var ave_xy = [0,0], variance_xy = [0,0];
                var sqr_err_xy = [];
                active_num = 0;
                for(var y=0;y<REQURE_POINT_NUM_PER_SIDE; y++){
                    for(var x=0; x<REQURE_POINT_NUM_PER_SIDE; x++){
                        index = x + y*REQURE_POINT_NUM_PER_SIDE;
                        if(point_status[index] == 1){ // 存在する
                            active_num ++;
                            move_vec_buff[index<<1] = curr_xy[index<<1] - prev_xy[index<<1]; //curr_xy[index<<1] - base_default_point_xy[index<<1];
                            move_vec_buff[(index<<1) +1] = curr_xy[(index<<1) +1] - prev_xy[(index<<1) + 1];//curr_xy[(index<<1) +1] - base_default_point_xy[(index<<1) + 1];
                            ave_xy[0] += move_vec_buff[index<<1] ;
                            ave_xy[1] += move_vec_buff[(index<<1)+1] ;
                        }
                    }
                }
                // 平均を算出
                if(active_num){
                    ave_xy[0] /= active_num;
                    ave_xy[1] /= active_num;
                }

                if(is_calc_depth){
                    var center_xy = [canvasWidth/2, canvasHeight/2];
                    var depth=0, num = 0;
                    for(var y=0;y<REQURE_POINT_NUM_PER_SIDE; y++){
                        for(var x=0; x<REQURE_POINT_NUM_PER_SIDE; x++){
                            index = x + y*REQURE_POINT_NUM_PER_SIDE;
                            if(point_status[index] == 1){ // 存在する
                                var dx = (curr_xy[index << 1] - center_xy[0]) ;
                                var dy =  (curr_xy[(index<<1) +1] - center_xy[1]);
                                /*
                                if(dx != 0){
                                    depth += (move_vec_buff[index<<1] - ave_xy[0])/ dx;
                                    num++;
                                }
                                if(dy != 0){
                                    depth += (move_vec_buff[(index<<1)+1] - ave_xy[1]) / dy;
                                }
                                */
                                if(dx!=0 && dy!= 0){
                                    num++;
                                    depth+= ((move_vec_buff[index<<1] - ave_xy[0])*dx +  (move_vec_buff[(index<<1)+1] - ave_xy[1])*dy) / (dx*dx + dy*dy);  
                                }
                               
                            }
                        }
                    }
                    if(num>0){
                        depth/=num; 
                        predict_flow_vec_accumulated[2] += depth * stat.fps;
                    }
                }
               
               /*
                if(active_num == 1+REQURE_POINT_NUM_PER_SIDE*REQURE_POINT_NUM_PER_SIDE){
                    console.log(active_num);
                    console.log(prev_xy);
                    console.log(curr_xy);
                    console.log(move_vec_buff);
                    console.log(point_status);
                }
                */

              
              
                // 修正された平均値を移動量と考える
                // 範囲外の場合はbaseを変更する
                var slide_base_point = function(dx, dy){ // 点が動いた方向を正
                    //console.log("slide" + dx + dy + "a" +active_num);
                    var ox, oy;
                    // 移動させる前にコピーする
                    for(var y=0;y<REQURE_POINT_NUM_PER_SIDE; y++){
                        for(var x=0; x<REQURE_POINT_NUM_PER_SIDE; x++){
                            index = x + y*REQURE_POINT_NUM_PER_SIDE;
                            c_curr_xy[index<<1] = curr_xy[index<<1];
                            c_curr_xy[(index<<1)+1] = curr_xy[(index<<1) +1];
                        }
                    }
                    for(var y=0;y<REQURE_POINT_NUM_PER_SIDE; y++){
                        for(var x=0; x<REQURE_POINT_NUM_PER_SIDE; x++){
                            index = x + y*REQURE_POINT_NUM_PER_SIDE;
                            ox = x - dx;
                            oy = y - dy;
                            if(ox < 0 || ox >= REQURE_POINT_NUM_PER_SIDE || oy <0 || oy >= REQURE_POINT_NUM_PER_SIDE){
                                point_status[index] = 0;
                            }else{
                                curr_xy[index << 1] = c_curr_xy[(ox + oy*REQURE_POINT_NUM_PER_SIDE)<<1];
                                curr_xy[(index << 1) + 1] = c_curr_xy[((ox + oy*REQURE_POINT_NUM_PER_SIDE)<<1) + 1];
                            }
                        }
                    }
                }
                

                predict_flow_vec_from_base[0] -= ave_xy[0];
                predict_flow_vec_from_base[1] -= ave_xy[1];


                var dx = 0, dy = 0;
                if(predict_flow_vec_from_base[0] > BASE_X_DIST){
                    dx = Math.floor(predict_flow_vec_from_base[0] / BASE_X_DIST);
                    predict_flow_vec_base[0] += BASE_X_DIST*dx;
                    predict_flow_vec_from_base[0] -= BASE_X_DIST*dx;
                }else if(predict_flow_vec_from_base[0] < - BASE_X_DIST){
                    dx = - Math.floor( (-predict_flow_vec_from_base[0]) / BASE_X_DIST);
                    predict_flow_vec_base[0] += BASE_X_DIST * dx;
                    predict_flow_vec_from_base[0] -= BASE_X_DIST*dx;
                }
                if(predict_flow_vec_from_base[1] > BASE_Y_DIST){
                    dy = Math.floor(predict_flow_vec_from_base[1] / BASE_Y_DIST);
                    predict_flow_vec_base[1] += BASE_Y_DIST*dy;
                    predict_flow_vec_from_base[1] -= BASE_Y_DIST*dy;
                }else if(predict_flow_vec_from_base[1] < - BASE_Y_DIST){
                    dy = - Math.floor( (-predict_flow_vec_from_base[1]) / BASE_Y_DIST);
                    predict_flow_vec_base[1] += BASE_Y_DIST * dy;
                    predict_flow_vec_from_base[1] -= BASE_Y_DIST*dy;
                }
                if(dx != 0 || dy != 0){
                    slide_base_point(dx, dy);
                }
                
              
                // 除外された点を復活
                for(var y=0; y<REQURE_POINT_NUM_PER_SIDE; y++){
                    for(var x=0; x<REQURE_POINT_NUM_PER_SIDE; x++){
                        index = x + y*REQURE_POINT_NUM_PER_SIDE;
                        if(point_status[index] == 0){
                            curr_xy[index<<1] = base_default_point_xy[index<<1] - predict_flow_vec_from_base[0];
                            curr_xy[(index<<1) + 1] = base_default_point_xy[(index<<1) + 1] - predict_flow_vec_from_base[1];
                        }else if(is_show_canvas){
                            draw_circle(ctx, curr_xy[index<<1], curr_xy[(index<<1)+1]);
                        }
                    }
                }
                // 最終的な初期値からの移動量
                predict_flow_vec_accumulated[0] = predict_flow_vec_base[0] + predict_flow_vec_from_base[0];
                predict_flow_vec_accumulated[1] = predict_flow_vec_base[1] + predict_flow_vec_from_base[1];
            }

            function relMouseCoords(event) {
                var totalOffsetX=0,totalOffsetY=0,canvasX=0,canvasY=0;
                var currentElement = this;

                do {
                    totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
                    totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
                } while(currentElement = currentElement.offsetParent)

                canvasX = event.pageX - totalOffsetX;
                canvasY = event.pageY - totalOffsetY;

                return {x:canvasX, y:canvasY}
            }
            HTMLCanvasElement.prototype.relMouseCoords = relMouseCoords;

            $(window).unload(function() {
                video.pause();
                video.src=null;
            });
    }

    screen_flow.prototype.show_canvas = function() {
        $("#canvas").show();
        is_show_canvas = true;
    }

    screen_flow.prototype.get_data = function() {
    	return {
    		active_num: active_num,
    		move: {x:  Math.floor(predict_flow_vec_accumulated[0]), y:Math.floor(predict_flow_vec_accumulated[1]), z:Math.floor(predict_flow_vec_accumulated[2])} 
    	};
    }
    screen_flow.prototype.reset = function() {
    	predict_flow_vec_accumulated = [0,0];
    	predict_flow_vec_base = [0,0];
    	predict_flow_vec_from_base = [0,0];
    }
    return screen_flow;
//}
})();
    