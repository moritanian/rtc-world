var SwipableControl = (function(){
	var instance ; // イベント関数にクラスインスタンスを参照するための苦肉の策
	var SwipableControl = function(send_msg_func, get_obj_info_func, get_user_id_callback){
		instance = this;
		this.MAX_USER_ID = 4;
		this.obj_class = ".swipable";
		this.send_msg_func = send_msg_func;
		this.swipe_area = $(".chat-canvas");
		this.swipe_objs = {};

		this.start = {x:0, y:0}; // スワイプしたときの最初の位置
		this.drag_offset = {x:0 , y:0};

		
		this.target_id = 0;

		//local setting
		this.get_world_info_flg = false;

		this.is_parent_user = true; // parent user は新規加入者に対し情報を渡す
		this.is_touch = ('ontouchstart' in window);


		this.get_world_info_flg = false;
		this.send_my_enter_flag = false;
		this.members = {}; //キーをuser_id, に
		this.member_num = 0;
		
		// 開始時刻を取得 
		this.start_time = this.get_time();

		this.get_obj_info_func = get_obj_info_func;
		
		// 生成するdom
		this.dom_models = {};

		this.get_user_id_callback = get_user_id_callback;
	}

	SwipableControl.prototype.setDomModel = function(key, dom_model){
		this.dom_models[key] = dom_model;
	}

	SwipableControl.prototype.mdown = function(e){
		// これまで前面にあったものを指定解除
		$(".front-obj").removeClass("front-obj");
		$(this).addClass("front-obj");

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
	    instance.target_id = instance.get_obj_id_from_dom($(drag));//$(drag).attr("obj-id");

	    this.touched = true; // フラグを立てる
	}

	//マウスカーソルが動いたときに発火
	SwipableControl.prototype.mmove = function(e) {
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
	   	instance.set_pos($(drag), event.pageX - instance.drag_offset.x,  event.pageY - instance.drag_offset.y);
	    var obj_id =  instance.get_obj_id_from_dom($(drag)); //$(drag).attr("obj-id"); 
	    instance.swipe_objs[obj_id].xp = event.pageX - instance.drag_offset.x; // global で格納
	    instance.swipe_objs[obj_id].yp = event.pageY - instance.drag_offset.y;  
	    instance.send_obj_info(obj_id);   
	}

	//マウスボタンが上がったら発火
	SwipableControl.prototype.mup = function(e) {
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
	    var obj_id = instance.get_obj_id_from_dom($(drag));//$(drag).attr("obj-id");
	    
	    //クラス名 .drag も消す
	    $(drag).removeClass("drag");

	    instance.swipe_objs[obj_id].xp = event.pageX - instance.drag_offset.x; // global で格納
	    instance.swipe_objs[obj_id].yp = event.pageY - instance.drag_offset.y;
	    instance.target_id = -1;
	    instance.send_obj_info(obj_id);

	   // $("#drag-state").text("mup");

	} 

	SwipableControl.prototype.get_touch_event = function(e) {
		//var event = e.changedTouches[0];
		var originalEvent = e.originalEvent;
		var event = originalEvent.changedTouches[0];

			  //event.changedTouches[0].
	    //var event = e.originalEvent;
		return event;
	}

	SwipableControl.prototype.get_obj_id_from_dom = function(dom) {
		return $(dom).attr("obj-id");
	}

	SwipableControl.prototype.set_obj_id_in_dom = function($dom, id) {
		$dom.attr("obj-id", id);
	}

	SwipableControl.prototype.set_user_id = function(user_id) {
		this.user_id = user_id;
		console.log("set user id");
		console.log(user_id);
		if(this.get_user_id_callback){
			this.get_user_id_callback(user_id);
		}
	}

	SwipableControl.prototype.set_pos = function(jq_obj, x, y) {
		$(jq_obj).css("top",  y + "px");
		$(jq_obj).css("left",  x + "px");
	}

	SwipableControl.prototype.push_obj = function(obj_info) {
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
	SwipableControl.prototype.add_obj = function(obj_id, obj_info) {
		//console.log("add_obj" + this.obj_class );
		this.swipe_objs[obj_id] = obj_info;
		var $swipe_obj;
		if(obj_info.model in this.dom_models){
			$swipe_obj = this.dom_models[obj_info.model].clone();
		}else{
			 console.error("cannot find dom model " + obj_info.model);
		}
		
		for (var i in obj_info.classes){
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
		this.set_obj_id_in_dom($swipe_obj, obj_id); //$swipe_obj.attr("obj-id", obj_id);
		this.swipe_area.append($swipe_obj);
		// obj_info に　jquery obectも追加
		this.swipe_objs[obj_id].jqobj = $swipe_obj.get(0);

	}

	// 新規にオブジェクトを世界に追加する
	// 追加情報をbroadcastも行う
	//  var obj_info = {vx: vx, vy : vy, xp: xp, yp: yp, classes:[classes[class_index]], width: width, height: height};
	SwipableControl.prototype.add_new_obj = function(obj_info){
		var obj_id = this.push_obj(obj_info);
		this.send_obj_info(obj_id);
		return this.swipe_objs[obj_id].jqobj;
	}

	// 場にあるswipe_objectの数　ただしidの最大ではない
	SwipableControl.prototype.obj_number = function() {
		return Object.keys(this.swipe_objs).length;
	} 

	SwipableControl.prototype.show_obj_number = function() {
		$("#obj-number").text(this.obj_number());
	}


	SwipableControl.prototype.connection_changed = function(member_num) {
		this.member_num = member_num;
		if(!this.get_world_info_flg && !this.send_my_enter_flag){ // 初めての dataChanelのコネクション完了時
			this.require_get_world_ans_num = member_num -1;
			this.send_my_enter_flag = true;
			this.send_my_enter_info();	 // 1回だけで帰ってこなければ誰もいないということで
		}
	}

	SwipableControl.prototype.send_obj_info = function(obj_id) {
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

	SwipableControl.prototype.send_my_enter_info = function() {
		var crt_time = this.get_time() ;
		this.elapsed_time = crt_time - this.start_time;
		msg_obj = {type: "enter", start_time: this.start_time, elapsed_time: this.elapsed_time};
		this.send_msg_func(JSON.stringify(msg_obj));
		console.log("my enter");
		console.log(msg_obj);
	}

	// 他でバイスからメッセージを受け取る
	SwipableControl.prototype.get_msg = function(msg) {
		var msg_obj = JSON.parse(msg);
		if(msg_obj.type === "objs_info" || msg_obj.type === "objs_all_info"){ //追加するobj情報// 参加者への初期情報もこれで伝える
			for(var obj_id in msg_obj.objs){
				var jqobj;
				let is_new = false;
				if(this.swipe_objs[obj_id]){ // 存在する場合は更新
					jqobj = this.swipe_objs[obj_id].jqobj; //jqobj 退避
					this.swipe_objs[obj_id] = msg_obj.objs[obj_id];
					this.swipe_objs[obj_id].jqobj = jqobj;
				}else{ // ない場合は追加
					console.log("add obj from other user");
					console.log(this.swipe_objs);
					this.add_obj(obj_id,  msg_obj.objs[obj_id]);
					jqobj = this.swipe_objs[obj_id].jqobj;
					is_new = true;
				}
				
				this.set_pos(jqobj , this.swipe_objs[obj_id].xp, this.swipe_objs[obj_id].yp);
				// 外部で定義された処理
				if(this.get_obj_info_func){
					this.get_obj_info_func(msg_obj.objs[obj_id], jqobj, is_new);
				}
			}
			if(msg_obj.type === "objs_all_info" && this.get_world_info_flg == false){
				this.require_get_world_ans_num --;
				console.log("require " + this.require_get_world_ans_num );
				console.log("id " + msg_obj.user_id);
				console.log(msg);
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

	// 外部から呼ばれる
	// obj_info に付加情報を更新する
	// sync = true でチャネルに送る
	SwipableControl.prototype.setObjInfoAttr = function($obj, attrHash, once){
		let obj_id = this.get_obj_id_from_dom($obj);
		for(let key in attrHash){
			this.swipe_objs[obj_id][key] = attrHash[key];	
		}
		
		this.send_obj_info(obj_id);
		if(once){
			for (let key in attrHash){
				delete this.swipe_objs[obj_id][key]; // 一度きりの送信
			}
		}
	}

	SwipableControl.prototype.get_time = function() {
		var date_obj = new Date();
		return date_obj.getTime();
	}
	return SwipableControl;
})();