var screen_flow_control = function(video, REQURE_POINT_NUM_PER_SIDE = 3, canvas){
	
	var _this = this;
	
	this.video = video;

	var active_num;
 	var predict_flow_vec_accumulated = [0,0,0]; // 予測された移動ベクトル 開始時からの移動
 	var predict_flow_vec_base = [0,0,0]; // baseの予測された移動ベクトル 
    var predict_flow_vec_from_base = [0,0,0]; // base(今のflow点)からの相対的な予測された移動ベクトル
    var predict_rotation = [0,0,0];
    var is_calc_depth = true;
    var stat;
    var options, ctx, videoWidth, videoHeight;
    var curr_img_pyr, prev_img_pyr, point_count, point_status, prev_xy, curr_xy, base_default_point_xy, c_curr_xy = [];
	var BASE_X_DIST, BASE_Y_DIST; // base点の距離

	var move_vec_buff = []; //各点の移動ベクトル(temp)

    var point_max_num = REQURE_POINT_NUM_PER_SIDE * REQURE_POINT_NUM_PER_SIDE;

    var demo_opt = function(){
        this.win_size = 20;
        this.max_iterations = 30;
        this.epsilon = 0.01;
        this.min_eigen = 0.001;
    }

    this.init = function(canvas){

		videoWidth = this.video.videoWidth;
		videoHeight = this.video.videoHeight;

    	if(canvas) {
    	
    		this.canvas = canvas;
    	
    		ctx = canvas.getContext('2d');

    	} else {
		
		    this.canvas = createCanvas();

		   	this.canvas.width = videoHeight;
		   	this.canvas.height = videoHeight;

		   	ctx = this.canvas.getContext('2d');

	    	ctx.fillStyle = "rgb(0,255,0)";
	    	ctx.strokeStyle = "rgb(0,255,0)";

		}

	    curr_img_pyr = new jsfeat.pyramid_t(3);
	    prev_img_pyr = new jsfeat.pyramid_t(3);
	    curr_img_pyr.allocate(videoWidth, videoHeight, jsfeat.U8_t|jsfeat.C1_t);
	    prev_img_pyr.allocate(videoWidth, videoHeight, jsfeat.U8_t|jsfeat.C1_t);

	    point_count = 0;
	    point_status = new Uint8Array(point_max_num); 
	    prev_xy = new Float32Array(point_max_num*2);
	    curr_xy = new Float32Array(point_max_num*2);

	    base_default_point_xy= [];
	    BASE_X_DIST = Math.floor(videoWidth/(REQURE_POINT_NUM_PER_SIDE + 1));
	    BASE_Y_DIST = Math.floor(videoHeight/(REQURE_POINT_NUM_PER_SIDE + 1));
	    
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

	}

    this.update = function(){
    	
    	if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    		
    		return;
		
		}
               
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
	    
	    var imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);

	    // swap flow data
	    var _pt_xy = prev_xy;
	    prev_xy = curr_xy;
	    curr_xy = _pt_xy;
	    var _pyr = prev_img_pyr;
	    prev_img_pyr = curr_img_pyr;
	    curr_img_pyr = _pyr;

	    jsfeat.imgproc.grayscale(imageData.data, videoWidth, videoHeight, curr_img_pyr.data[0]);
	    
	    curr_img_pyr.build(curr_img_pyr.data[0], true);

	    jsfeat.optical_flow_lk.track(prev_img_pyr, curr_img_pyr, prev_xy, curr_xy, point_count, options.win_size|0, options.max_iterations|0, point_status, options.epsilon, options.min_eigen);

	    auto_add_flow_point(ctx);

    };

    this.get_data = function(){
    	return {
    	   active_num: active_num,
    	   move: {x: -Math.floor(predict_flow_vec_accumulated[0]), y:-Math.floor(predict_flow_vec_accumulated[1]), z:Math.floor(predict_flow_vec_accumulated[2])},
    	   rot: {x: predict_rotation[0], y:predict_rotation[1], z: predict_rotation[2]},
        };
    };

    this.reset = function(){
    	predict_flow_vec_accumulated = [0,0,0];
    	predict_flow_vec_base = [0,0,0];
    	predict_flow_vec_from_base = [0,0,0];
        predict_rotation = [0,0,0];
    }

    if(this.video.videoWidth == 0) {

    	this.video.addEventListener('loadeddata', function(){_this.init()});
    
    } else {

    	this.init(canvas);

    }

    function createCanvas(){
   		
   		var canvas = document.createElement("canvas");
		canvas.id = "canvas";
   		document.body.appendChild(canvas);
   		canvas.style.display = "none";
   		
   		return canvas;

   	}

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
            var center_xy = [videoWidth/2, videoHeight/2];
            var depth=0, num = 0;
            var rot = 0;
            for(var y=0;y<REQURE_POINT_NUM_PER_SIDE; y++){
                for(var x=0; x<REQURE_POINT_NUM_PER_SIDE; x++){
                    index = x + y*REQURE_POINT_NUM_PER_SIDE;
                    if(point_status[index] == 1){ // 存在する
                        var dx = (curr_xy[index << 1] - center_xy[0]) ;
                        var dy =  (curr_xy[(index<<1) +1] - center_xy[1]);
                        var r_2 = dx*dx + dy*dy;
                        /*
                        if(dx != 0){
                            depth += (move_vec_buff[index<<1] - ave_xy[0])/ dx;
                            num++;
                        }
                        if(dy != 0){
                            depth += (move_vec_buff[(index<<1)+1] - ave_xy[1]) / dy;
                        }
                        */
                        if(r_2 > 30){
                            num++;
                            depth+= ((move_vec_buff[index<<1] - ave_xy[0])*dx +  (move_vec_buff[(index<<1)+1] - ave_xy[1])*dy) / r_2;  
                            rot += (dx * (move_vec_buff[(index<<1)+1] - ave_xy[1]) - dy*(move_vec_buff[index<<1] - ave_xy[0])) / r_2; 
                        }
                       
                    }
                }
            }
            if(num>0){
                depth/=num; 
                predict_flow_vec_accumulated[2] += depth * videoHeight; //だいたいx,yと同じスケールになるようにかけてる
                rot /= num;
                if(Math.abs(rot) <= 1.0){
                    predict_rotation[2] += Math.asin(rot);
                }
            }
        }
       
      
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
                }
            }
        }
        // 最終的な初期値からの移動量
        predict_flow_vec_accumulated[0] = predict_flow_vec_base[0] + predict_flow_vec_from_base[0];
        predict_flow_vec_accumulated[1] = predict_flow_vec_base[1] + predict_flow_vec_from_base[1];
    
    }



}