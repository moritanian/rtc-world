var SwipeObjControl = (function(){
	var instance ; // イベント関数にクラスインスタンスを参照するための苦肉の策
	var SwipeObjControl = function(send_msg_func){
		instance = this;
		this.MAX_USER_ID = 4;
		this.obj_class = ".swipe-obj";
		this.start = {x:0, y:0}; // スワイプしたときの最初の位置
		this.friction = 1.01; // マサツ
		this.force = 2.0;
		this.send_msg_func = send_msg_func;
		this.swipe_area = $(".swipe-area");
		this.swipe_objs = {};
		
		this.drag_offset = {x:0 , y:0};
		this.F_RATE_INIT = 40.0;
		this.f_rate = this.F_RATE_INIT;
		this.target_id = 0;

		//local setting
		var local_screen = {};
		local_screen.x = screen.width;
		local_screen.y = screen.height;
		this.local_world = {pos: {x:0, y:0}, screen: local_screen};
		
		this.get_world_info_flg = false;

		this.is_parent_user = true; // parent user は新規加入者に対し情報を渡す
		this.world = {boarder: {x: 760, y : 500}};
		this.is_touch = ('ontouchstart' in window);

		this.compassdir = {x: 0 , y:0, z:0};
		this.acc = {x: 0 , y:0, z:0};
		this.has_compass = false;
		// conpass
		if (window.DeviceOrientationEvent) {
			this.init_compass_and_acc();
		}else{
			//$( "#com_val").text("compass not available");
		}
		this.members = {}; //キーをuser_id, に
		this.init_boarder_line();
		this.is_render_myself = true; // このクラス内でレンダー実行するか
		

		//setTimeout(function(){instance.update()}, 1000/this.f_rate);
		this.update();

		this.render_handler = 0;
	}

	// render関数を外部に渡す。
	SwipeObjControl.prototype.get_render_func = function(is_render_outer = false){
		if(is_render_outer){ //外部から呼び出す
			this.is_render_myself = false;
			if(this.render_handler){
				window.cancelAnimationFrame(this.render_handler);
			}
		}
		return function(){instance.update();};
	}

	// start button がおされた
	SwipeObjControl.prototype.start_simulation = function(){
		this.get_world_info_flg = false;
		this.send_my_enter_flag = false;
		this.members = {}; //キーをuser_id, に
		this.member_num = 0;
		
		// 開始時刻を取得 
		this.start_time = this.get_time();
		try{
			//this.tracking = new screen_flow(2, true, render=this.get_render_func());
			this.tracking = new screen_flow(2, true);
		}catch(e){
			console.log("cannot use camera tracking in this environment");
		}
	}

	SwipeObjControl.prototype.init_compass_and_acc = function(){
		//$( "#com_val" ).text("init compass");

		//$( window ).on( "orientationchange", {instance: instance}, function(event){
		$( window ).on( "deviceorientation", function(e){
			var evenet = e.originalEvent;

			instance.has_compass = evenet.absolute;
			if(event.webkitCompassHeading) {
				// Apple works only with this, alpha doesn't work
				instance.compassdir = event.webkitCompassHeading;  
			}
			else
			{ 
				var k = 3.1415 * 2/360.0;
				instance.compassdir.x = event.gamma * k;//event.alpha * k + 1.5
				instance.compassdir.y = event.beta * k;
				instance.compassdir.z = 0.0;//event.gamma * k;
				// 値が小さい時は水平とする
				var compass_as_zero_limit = 0.1;
				if(Math.abs(instance.compassdir.x) < compass_as_zero_limit){
					instance.compassdir.x = 0.0;
				}
				if(Math.abs(instance.compassdir.y) < compass_as_zero_limit){
					instance.compassdir.y = 0.0;
				}
			}
		});

		$( window ).on( "devicemotion",  function(e){
			var evenet = e.originalEvent;
				
				instance.acc.x = event.acceleration.x;//event.alpha * k + 1.5
				instance.acc.y = event.acceleration.y;
				instance.acc.z = event.acceleration.z;
		});
	}



	SwipeObjControl.prototype.mdown = function(e){
	    //クラス名に .drag を追加
	    $(this).addClass("drag");
	    //タッチデイベントとマウスのイベントの差異を吸収
	    //if(e.type === "mousedown") {
	    if(!instance.is_touch) {
	        var event = e;
	    } else {
	    	var event = instance.get_touch_event(e);
	    }
	    //要素内の相対座標を取得
	    instance.drag_offset.x = event.pageX - this.offsetLeft;
	    instance.drag_offset.y = event.pageY - this.offsetTop;

	    instance.start.x = event.pageX ;
	    instance.start.y = event.pageY;

	    //ムーブイベントにコールバック
	    var drag = $(".drag");
	    if(!instance.is_touch){
	    	$(this).on("mousemove", instance.mmove);
	    	$(this).on("mouseup",  instance.mup);
	    	$(this).on("mouseleave", instance.mup);
	    }else{
	    	$(this).bind("touchmove", instance.mmove);
	    	$(this).bind("touchend",  instance.mup);
	    	$(this).bind("touchleave",  instance.mup);
	   	}
	    instance.target_id = $(drag).attr("obj-id");

	    instance.swipe_objs[instance.target_id].vx = 0;
	    instance.swipe_objs[instance.target_id].vy = 0;
	   // $("#drag-state").text("mdown");

	    this.touched = true; // フラグを立てる
	}

	//マウスカーソルが動いたときに発火
	SwipeObjControl.prototype.mmove = function(e) {
		// 開始していない場合は動かないようにする
		// 過剰動作の防止
		if (!this.touched) {
			return;
		}
	    //ドラッグしている要素を取得
	    //var drag = document.getElementsByClassName("drag")[0];
	    var drag = $(".drag");
	    //同様にマウスとタッチの差異を吸収
	    if(e.type === "mousemove") {
	        var event = e;
	    } else {
	        //var event = e.changedTouches[0];
	    	var event = instance.get_touch_event(e);
	    	
	    }
	    //フリックしたときに画面を動かさないようにデフォルト動作を抑制
	    e.preventDefault();
	    //マウスが動いた場所に要素を動かす
	   	instance.set_pos($(drag), event.pageX - instance.drag_offset.x + instance.local_world.pos.x,  event.pageY - instance.drag_offset.y + instance.local_world.pos.y);
	    var obj_id = $(drag).attr("obj-id"); 
	    instance.swipe_objs[obj_id].xp = event.pageX - instance.drag_offset.x + instance.local_world.pos.x; // global で格納
	    instance.swipe_objs[obj_id].yp = event.pageY - instance.drag_offset.y + instance.local_world.pos.y;  
	    instance.send_obj_info(obj_id);   
	}

	//マウスボタンが上がったら発火
	SwipeObjControl.prototype.mup = function(e) {
		if (!this.touched) {
			return;
		}
		// タッチ処理は終了したため、フラグをたたむ
		this.touched = false;
	   
	    var drag = $(".drag");
	     //同様にマウスとタッチの差異を吸収
	    if(e.type === "mouseup" || e.type === "mouseleave") {
	        var event = e;
	    } else {
	    	var event = instance.get_touch_event(e);	
	    }
	    //ムーブベントハンドラの消去
	    $(this).unbind("mousemove", instance.mmove);
	    $(this).unbind("mouseup", instance.mup);
	    $(this).unbind("mouseleave", instance.mup);
	    $(this).unbind("touchmove", instance.mmove);
	    $(this).unbind("touchend", instance.mup);
	    $(this).unbind("touchleave", instance.mup);
	    var obj_id = $(drag).attr("obj-id");
	    
	    //クラス名 .drag も消す
	    $(drag).removeClass("drag");

	    instance.swipe_objs[obj_id].vx = - (event.pageX - instance.start.x)*instance.force;
	    instance.swipe_objs[obj_id].vy = - (event.pageY - instance.start.y)*instance.force;
	    instance.swipe_objs[obj_id].xp = event.pageX - instance.drag_offset.x + instance.local_world.pos.x; // global で格納
	    instance.swipe_objs[obj_id].yp = event.pageY - instance.drag_offset.y + instance.local_world.pos.y;
	    instance.target_id = -1;
	    instance.send_obj_info(obj_id);

	   // $("#drag-state").text("mup");

	} 

	SwipeObjControl.prototype.get_touch_event = function(e) {
		//var event = e.changedTouches[0];
		var originalEvent = e.originalEvent;
		var event = originalEvent.changedTouches[0];

			  //event.changedTouches[0].
	    //var event = e.originalEvent;
		return event;
	}

	SwipeObjControl.prototype.update = function() {
		var update_func_start = this.get_time();
		if(this.is_render_myself){
			//setTimeout(function(){instance.update()}, 1000/this.f_rate);
			this.render_handler = window.requestAnimationFrame(function(){instance.update()});
			if(this.timer){
				this.timer.stop();
				this.f_rate = Math.floor(1000/this.timer.get_runtime());
			}else{
				this.timer = new stopwatch();
			}
			this.timer.start();
		}

		if(this.tracking){
			var move_data = this.tracking.get_data();
			var scale = 1;
			this.set_boarder_line_pos({x: move_data.move.x/scale, y: move_data.move.y/scale} );
		}else// （スマホのみ）傾きによる加速
		if(this.has_compass){
			//$("#com_val").text("compass heading" + instance.compassdir.x+ ": " + instance.compassdir.y);
			var gravity = 20.8;
			//instance.swipe_objs[obj_id].vx += Math.sin(instance.compassdir.x) *  gravity;
			//instance.swipe_objs[obj_id].vy += Math.sin(instance.compassdir.y) *  gravity;
			
			this.move_boarder_line(this.compassdir);
			
		}

		
		//$(this.obj_class).each(function(){
		for(var obj_id in this.swipe_objs){
			//var obj_id = $(this).attr("obj-id");
			if(obj_id != instance.target_id){
				
				// マサツによる減速
				//instance.swipe_objs[obj_id].vx /= 1 + 0.5/instance.f_rate; //instance.friction;
				//instance.swipe_objs[obj_id].vy /= 1 + 0.5/instance.f_rate;//instance.friction;
				
				// 位置積分
				instance.swipe_objs[obj_id].xp += instance.swipe_objs[obj_id].vx/instance.f_rate; 
				instance.swipe_objs[obj_id].yp += instance.swipe_objs[obj_id].vy/instance.f_rate;
				// 壁の反射
				if(instance.swipe_objs[obj_id].xp + instance.swipe_objs[obj_id].width > instance.world.boarder.x){
					//instance.swipe_objs[obj_id].xp = 0;
					instance.swipe_objs[obj_id].vx = - Math.abs(instance.swipe_objs[obj_id].vx);
				}else if(instance.swipe_objs[obj_id].xp < 0){
					//instance.swipe_objs[obj_id].xp = instance.world.boarder.x;
					instance.swipe_objs[obj_id].vx = Math.abs(instance.swipe_objs[obj_id].vx);
				}

				if(instance.swipe_objs[obj_id].yp +  instance.swipe_objs[obj_id].height > instance.world.boarder.y){
					//instance.swipe_objs[obj_id].yp = 0;
					instance.swipe_objs[obj_id].vy = - Math.abs(instance.swipe_objs[obj_id].vy);
					
				}else if(instance.swipe_objs[obj_id].yp < 0){
					//instance.swipe_objs[obj_id].yp = instance.world.boarder.y;
					instance.swipe_objs[obj_id].vy =  Math.abs(instance.swipe_objs[obj_id].vy);
					
				}
				instance.set_pos(instance.swipe_objs[obj_id].jqobj ,instance.swipe_objs[obj_id].xp, instance.swipe_objs[obj_id].yp);
			}else{

			}
		};

		// TODO
		// かかった時間をもとにfpsを調整
		/*
		var elapsed_time = this.get_time() - update_func_start;
		if( 1000/this.F_RATE_INIT < elapsed_time){
			this.f_rate = 1000/elapsed_time;
		}else{
			this.f_rate = this.F_RATE_INIT;
		}
		*/
		$("#fps").text(this.f_rate);
		
		this.show_obj_number();
	}

	SwipeObjControl.prototype.set_user_id = function(user_id) {
		this.user_id = user_id;
		$("#user-id").val(user_id);
		if(user_id > 1){
			this.local_world.pos = {x:400, y:0};
			this.update_boarder_line();
		}

	}

	SwipeObjControl.prototype.set_pos = function(jq_obj, x, y) {
		// global 座標から　localへ変換
		var local_x = x - this.local_world.pos.x;
		var local_y = y - this.local_world.pos.y;
		$(jq_obj).css("top",  local_y + "px");
		$(jq_obj).css("left",  local_x + "px");
	}

	SwipeObjControl.prototype.push_obj = function(obj_info) {
		var max_id = 1;
		for(let id in this.swipe_objs){
			id = Math.floor(id); // 数値に置き換え
			if(id > max_id){
				max_id = id;
			}
		}
		this.add_obj(max_id + 1, obj_info);
		return max_id + 1;
	}

	// objを追加する
	SwipeObjControl.prototype.add_obj = function(obj_id, obj_info) {
		//console.log("add_obj" + this.obj_class );
		this.swipe_objs[obj_id] = obj_info;
		var $swipe_obj = $("<div class='swipe-ball swipe-obj'></div>");
		for (var i  in obj_info.classes){
			$swipe_obj.addClass(obj_info.classes[i]);
		}
		// 大きさ
		if(obj_info.width){
			$swipe_obj.css("width", obj_info.width + "px");
		}
		if(obj_info.height){
			$swipe_obj.css("height", obj_info.height + "px");
		}
		if(!this.is_touch){
			$swipe_obj.on("mousedown",this.mdown);
	    }else{
	   		$swipe_obj.bind("touchstart", this.mdown);
		}
		$swipe_obj.attr("obj-id", obj_id);
		this.swipe_area.append($swipe_obj);
		// obj_info に　jquery obectも追加
		this.swipe_objs[obj_id].jqobj = $swipe_obj.get(0);

	}

	// 新規にオブジェクトを世界に追加する
	// 追加情報をbroadcastも行う
	//  var obj_info = {vx: vx, vy : vy, xp: xp, yp: yp, classes:[classes[class_index]], width: width, height: height};
	SwipeObjControl.prototype.add_new_obj = function(obj_info){
		var obj_id = this.push_obj(obj_info);
		this.send_obj_info(obj_id);
	}

	// 場にあるswipe_objectの数　ただしidの最大ではない
	SwipeObjControl.prototype.obj_number = function() {
		return Object.keys(this.swipe_objs).length;
	} 

	SwipeObjControl.prototype.show_obj_number = function() {
		$("#obj-number").text(this.obj_number());
	}


	SwipeObjControl.prototype.connection_changed = function(member_num) {
		this.member_num = member_num;
		if(!this.get_world_info_flg && !this.send_my_enter_flag){ // 初めての dataChanelのコネクション完了時
			this.require_get_world_ans_num = member_num -1;
			this.send_my_enter_flag = true;
			this.send_my_enter_info();	 // 1回だけで帰ってこなければ誰もいないということで
		}
	}

	SwipeObjControl.prototype.send_obj_info = function(obj_id) {
		var msg_obj = {};
		msg_obj.objs = {};
		
		if(obj_id){
			msg_obj.type = "objs_info";
			msg_obj.objs[obj_id] = this.swipe_objs[obj_id];
		}else{
			msg_obj.type = "objs_all_info";
			msg_obj.objs = this.swipe_objs;
			msg_obj.user_id = this.user_id;
		}
		var json_obj = JSON.stringify(msg_obj);
		this.send_msg_func(json_obj);
	}

	SwipeObjControl.prototype.send_my_enter_info = function() {
		var crt_time = this.get_time() ;
		this.elapsed_time = crt_time - this.start_time;
		msg_obj = {type: "enter", start_time: this.start_time, elapsed_time: this.elapsed_time};
		this.send_msg_func(JSON.stringify(msg_obj));
		console.log("my enter");
		console.log(msg_obj);
	}

	// 他でバイスからメッセージを受け取る
	SwipeObjControl.prototype.get_msg = function(msg) {
		var msg_obj = JSON.parse(msg);
		if(msg_obj.type === "objs_info" || msg_obj.type === "objs_all_info"){ //追加するobj情報// 参加者への初期情報もこれで伝える
			for(var obj_id in msg_obj.objs){
				if(this.swipe_objs[obj_id]){ // 存在する場合は更新
					var jqobj = this.swipe_objs[obj_id].jqobj; //jqobj 退避
					this.swipe_objs[obj_id] = msg_obj.objs[obj_id];
					this.swipe_objs[obj_id].jqobj = jqobj;
				}else{ // ない場合は追加
					this.add_obj(obj_id,  msg_obj.objs[obj_id]);
				}
			}
			if(msg_obj.type === "objs_all_info" && this.get_world_info_flg == false){
				this.require_get_world_ans_num --;
				console.log("require " + this.require_get_world_ans_num );
				console.log("id " + msg_obj.user_id);
				this.members[msg_obj.user_id] = "connected";
				if(this.require_get_world_ans_num == 0){
					this.get_world_info_flg = true;
					for(var user_id = 1; user_id < this.MAX_USER_ID; user_id++){
						console.log(user_id);
						console.log(this.members[user_id]);
						if(!(this.members[user_id] === "connected")){
							this.set_user_id(user_id);
							break;
						}
					}
					console.log("set user id" + this.user_id);
					console.log(this.members);
				}
			}
		}else if(msg_obj.type === "enter"){ // 新規加入者がはいってきた
			console.log("get msg enter");
			//console.log("time stamp me: " + this.start_time + "other" + msg_obj.start_time);
			if(!this.get_world_info_flg  &&  msg_obj.elapsed_time <  this.elapsed_time){ // この時、他からデータをもらってない場合、自分がfirst user　ただし、最初の二人の接続は開始時間で比べる
				this.get_world_info_flg = true;
				this.set_user_id(1);
				console.log("set user id parent");

			}
			if(this.is_parent_user){
				console.log("send obj info first");
				this.send_obj_info();
			}
		}
	}

	SwipeObjControl.prototype.init_boarder_line = function(){
		this.world.boarder_lines = [];
		var _init_boarder_line = function(start, goal){
			var line_info = instance.create_line(start, goal);
			instance.swipe_area.append(line_info.line);
			instance.world.boarder_lines.push(line_info);
		}

		_init_boarder_line({x: 0, y:0}, {x:0, y: this.world.boarder.y});
		_init_boarder_line({x: 0, y:0}, {x: this.world.boarder.x, y:0});
		_init_boarder_line({x: this.world.boarder.x , y:0}, {x:this.world.boarder.x , y: this.world.boarder.y});
		_init_boarder_line({x: 0, y:this.world.boarder.y}, {x:this.world.boarder.x , y: this.world.boarder.y});
		
	}

	SwipeObjControl.prototype.update_boarder_line = function(){
		for(var i in this.world.boarder_lines){
			var line_info = this.world.boarder_lines[i];
			this.set_line(line_info.start, line_info.goal, line_info.line);
		}	
	}

	SwipeObjControl.prototype.create_line = function(start, goal){
		var $line = $("<div class='line'></div>");
		this.set_line(start, goal, $line);
		var line_info = {line: $line, start: start, goal: goal};
		return line_info;
	}

	// 入力はグローバル座標
	SwipeObjControl.prototype.set_line = function(start, goal, $line){
	    var d_x = goal.x - start.x;
	    var d_y = goal.y - start.y;
	    var len = Math.sqrt(d_x　* d_x + d_y * d_y);   
	    if(d_x == 0){
	  		d_x = 0.1;
	  	}
	  	$line.css("width", len);
	  	var deg = Math.atan(d_y/d_x) * 180.0 / Math.PI;  //deg = 0;
	    $line.css("transform", "rotate(" + deg + "deg)");
	    $line.css("top", start.y - this.local_world.pos.y + d_y/2 + "px");
	    $line.css("left", start.x - this.local_world.pos.x + d_x/2 - len/2.0 + "px");
	}

	// 指定された　x,y だけ平行移動
	SwipeObjControl.prototype.move_boarder_line = function(move_xy) {
		this.set_boarder_line_pos({x: move_xy.x + this.local_world.pos.x, y: move_xy.y + this.local_world.pos.y});
	}
	SwipeObjControl.prototype.set_boarder_line_pos = function(pos) {	
		if(pos.x < this.world.boarder.x - this.local_world.screen.x && pos.x >= 0){
			this.local_world.pos.x = pos.x;
		}
		if(pos.y < this.world.boarder.y - this.local_world.screen.y && pos.y >= 0){
			this.local_world.pos.y = pos.y;
		}
		this.update_boarder_line();
	}

	SwipeObjControl.prototype.get_time = function() {
		var date_obj = new Date();
		return date_obj.getTime();
	}
	return SwipeObjControl;
})();