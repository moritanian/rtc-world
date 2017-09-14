/*
	fast edge  + optical flow
*/

var VisualOdometry = function(_videoWidth, _videoHeight){
	"use strict";

	/*
		private members
	*/
	var fastThresold = 20;
	
	var opticalFlowOptions;
	
	var videoWidth = _videoWidth || 640;
	
	var videoHeight = _videoHeight || 480;
	
	var point_max_num = 10; // 変える?
	
	var corners, point_status, 
		curr_img_pyr, prev_img_pyr, 
		prev_xy, curr_xy;

	var move_vec_buff;
	var cameraRotation;
	var cameraPosition;
  
	/*
		public methods
	*/

	this.setFastThreshold = function(threshold){
		fastThresold = threshold;
        jsfeat.fast_corners.set_threshold(threshold);
	}

	this.setOpticalFlowOptions = function(options){

		opticalFlowOptions.win_size = options.win_size  
			|| opticalFlowOptions.win_size;

		opticalFlowOptions.max_iterations = 
			options.max_iterations || 
			opticalFlowOptions.max_iterations;
		
		opticalFlowOptions.epsilon = 
			options.epsilon || opticalFlowOptions.epsilon;
		
		opticalFlowOptions.min_eigen = 
			options.min_eigen || 
			opticalFlowOptions.min_eigen;
	}

	this.update = function(){

		var point_num = 0, _pt_xy, _pyr;

		return function(imageData){

			// swap flow data
			_pt_xy = prev_xy;
			prev_xy = curr_xy;
			curr_xy = _pt_xy;			
			_pyr = prev_img_pyr;
			prev_img_pyr = curr_img_pyr;
			curr_img_pyr = _pyr;

			// grascale
			jsfeat.imgproc.grayscale(
				imageData.data, 
				videoWidth, 
				videoHeight, 
				curr_img_pyr.data[0]);

			// pyramid
			curr_img_pyr.build(curr_img_pyr.data[0], true);


			// fast
			var border = 5;
			var count = jsfeat.fast_corners.detect(curr_img_pyr.data[0], corners, border);

			// set curr_xy
			point_num = count < point_max_num ? count : point_max_num;
			for(var i = 0; i < point_num; i++){
				prev_xy[i<<1] = corners[i].x;
				prev_xy[(i<<1) + 1] = corners[i].y;
			}

			// optical flow
			/*
				prev_img_prv, curr_img_pyr, prev_xy, 
				=> curr_xy
			*/
			jsfeat.optical_flow_lk.track(prev_img_pyr, curr_img_pyr, 
				prev_xy, curr_xy, point_num, 
				opticalFlowOptions.win_size, 
				opticalFlowOptions.max_iterations, 
				point_status, 
				opticalFlowOptions.epsilon, 
				opticalFlowOptions.min_eigen);
			
			// calculate camera transform
			calculateCameraTransition(point_num);
			
		}

	}();

	this.getCameraTransitionParams = function(){
		return {
			position: [
				cameraPosition[0],
				cameraPosition[1], 
				cameraPosition[2]
			],
			rotation: [
				cameraRotation[0], 
				cameraRotation[1], 
				cameraRotation[2]
			]
		};
	}

	this.resetCameraTransitionParam = function(){
		cameraPosition = [0, 0 ,0];
		cameraRotation = [0, 0, 0];
	}

	/*
		private methods 
	*/

	function calculateCameraTransition(point_num){

		var average, active_num = 0, ave_xy = [0, 0]; 

		// average 
		for(var i = 0; i < point_num; i++){
			
			if(point_status[i] === 0)
				continue;

			active_num++;
			
			move_vec_buff[i<<1] = 
				curr_xy[i<<1] - prev_xy[i<<1];
			
			move_vec_buff[(i<<1) + 1] = 
				curr_xy[(i<<1) + 1] - prev_xy[(i<<1) + 1];

			ave_xy[0] += move_vec_buff[i<<1];
			ave_xy[1] += move_vec_buff[(i<<1) + 1];

		}

		if(active_num > 0) {
			ave_xy[0] /= active_num;
			ave_xy[1] /= active_num;
		}

		// TODO rotation and depth
		
		cameraPosition[0] += ave_xy[0];
		cameraPosition[1] += ave_xy[1];
	}

	// init vars
	this.resetCameraTransitionParam();

	//img_u8 = new jsfeat.matrix_t(videoWidth, videoHeight, jsfeat.U8_t | jsfeat.C1_t);
	corners = [];
	
	var i = videoWidth * videoHeight;
	while(--i >= 0) {
		corners[i] = new jsfeat.keypoint_t(0,0,0,0);
	}

	this.setFastThreshold(fastThresold);

	opticalFlowOptions = {};
	this.setOpticalFlowOptions({
		win_size: 20,
		max_iterations: 30,
		epsilon: 0.01,
		min_eigen: 0.001
	});

	curr_img_pyr = new jsfeat.pyramid_t(3);
	prev_img_pyr = new jsfeat.pyramid_t(3);
	curr_img_pyr.allocate(videoWidth, videoHeight, jsfeat.U8_t|jsfeat.C1_t);
	prev_img_pyr.allocate(videoWidth, videoHeight, jsfeat.U8_t|jsfeat.C1_t);

	prev_xy = new Float32Array(point_max_num * 2);
	curr_xy = new Float32Array(point_max_num * 2);
	point_status = new Uint8Array(point_max_num); 
	move_vec_buff = new Float32Array(point_max_num * 2)
}
