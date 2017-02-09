var SwipeObjControl = function(send_msg_func){
	this.obj_class = ".swipe-obj";
	this.start = {x:0, y:0}; // スワイプしたときの最初の位置
	this.friction = 5.0; // マサツ
	var instance = this;
	this.send_msg_func = send_msg_func;
	this.swipe_area = $(".swipe-area");
	this.swipe_objs = {};
	//this.last_id = 1;
	//var obj_info = {vx: 0, vy : 0, xp: 200, yp: 200};
	//instance.add_obj(instance.last_id, obj_info);
	/*
	$(this.obj_class).each(function(){
		instance.last_id ++;
		
		$(this).on("mousedown", {instance: instance}, instance.mdown);
        $(this).on("touchstart", {instance: instance}, instance.mdown);
		$(this).attr("obj-id", instance.last_id);
		var obj_info = {vx: 0, vy : 0, xp: 200, yp: 200};
		console.log(obj_info.xp);
		instance.swipe_objs.push(obj_info);
		
		var obj_info = {vx: 0, vy : 0, xp: 200, yp: 200};
		instance.add_obj(instance.last_id, obj_info);
	});
	*/
	//var x, y;
	this.drag_offset = {x:0 , y:0};
	this.f_rate = 40.0;
	this.target_id = 0;
	this.local_world = {};
	this.get_world_info_flg = false;

	this.is_parent_user = false; // parent user は新規加入者に対し情報を渡す


}

SwipeObjControl.prototype.mdown = function(e){

	console.log("mdown");
    var instance = e.data.instance;
    //クラス名に .drag を追加
    $(this).addClass("drag");
    //タッチデイベントとマウスのイベントの差異を吸収
    if(e.type === "mousedown") {
        var event = e;
        } else {
        var event = e.changedTouches[0];
    }
    //要素内の相対座標を取得
    instance.drag_offset.x = event.pageX - this.offsetLeft;
    instance.drag_offset.y = event.pageY - this.offsetTop;

    instance.start.x = event.pageX ;
    instance.start.y = event.pageY;

    //ムーブイベントにコールバック
    $(document).on("mousemove", {instance: instance}, instance.mmove);
    $(document).on("touchmove", {instance: instance}, instance.mmove);
    var drag = $(".drag");
    $(drag).on("mouseup", {instance: instance}, instance.mup);
    $(document).on("mouseleave", {instance: instance}, instance.mup);
    $(drag).on("touchend", {instance: instance}, instance.mup);
    $(document).on("touchleave", {instance: instance}, instance.mup);
   
    instance.target_id = $(drag).attr("obj-id");

}

//マウスカーソルが動いたときに発火
SwipeObjControl.prototype.mmove = function(e) {
    var instance = e.data.instance;
    //ドラッグしている要素を取得
    //var drag = document.getElementsByClassName("drag")[0];
    var drag = $(".drag");
    //同様にマウスとタッチの差異を吸収
    if(e.type === "mousemove") {
        var event = e;
    } else {
        var event = e.changedTouches[0];
    }
    //フリックしたときに画面を動かさないようにデフォルト動作を抑制
    e.preventDefault();
    //マウスが動いた場所に要素を動かす
   	instance.set_pos($(drag), event.pageX - instance.drag_offset.x,  event.pageY - instance.drag_offset.y);
   // $(drag).css("top", event.pageY - y + "px");
    //$(drag).css("left", event.pageX - x + "px");
  
    //マウスボタンが離されたとき、またはカーソルが外れたとき発火
   // $(drag).on("mouseup", {instance: instance}, instance.mup);
   // $(document).bind("mouseleave", {instance: instance}, instance.mup);
   // $(drag).on("touchend", {instance: instance}, instance.mup);
   // $(document).on("touchleave", {instance: instance}, instance.mup);
    
}

//マウスボタンが上がったら発火
SwipeObjControl.prototype.mup = function(e) {
	console.log("up");
    var instance = e.data.instance;
    var drag = $(".drag");
     //同様にマウスとタッチの差異を吸収
    if(e.type === "mouseup" || e.type === "mouseleave") {
        var event = e;
    } else {
        var event = e.changedTouches[0];
    }
    //ムーブベントハンドラの消去
    $(document).unbind("mousemove", instance.mmove);
    $(drag).unbind("mouseup", instance.mup);
    $(document).unbind("mouseleave", instance.mup);
    $(document).unbind("touchmove", instance.mmove);
    $(drag).unbind("touchend", document.mup);
    $(document).unbind("touchleave", document.mup);
    var obj_id = $(drag).attr("obj-id");
    
    //クラス名 .drag も消す
    $(drag).removeClass("drag");

    console.log("mup id = " + obj_id);
    instance.swipe_objs[obj_id].vx = (event.pageX - instance.start.x)/instance.friction;
    instance.swipe_objs[obj_id].vy = (event.pageY - instance.start.y)/ instance.friction;
    instance.swipe_objs[obj_id].xp = event.pageX - instance.drag_offset.x + instance.local_world.pos.x; // global で格納
    instance.swipe_objs[obj_id].yp = event.pageY - instance.drag_offset.y + instance.local_world.pos.y;
    instance.target_id = -1;
    instance.send_obj_info(obj_id);
} 

SwipeObjControl.prototype.update = function(instance) {
	$(this.obj_class).each(function(){
		var obj_id = $(this).attr("obj-id");
		if(obj_id != instance.target_id){
			 instance.swipe_objs[obj_id].xp += instance.swipe_objs[obj_id].vx/instance.f_rate; 
			 instance.swipe_objs[obj_id].yp += instance.swipe_objs[obj_id].vy/instance.f_rate;
			 
			 instance.set_pos($(this),instance.swipe_objs[obj_id].xp, instance.swipe_objs[obj_id].yp);
		}else{

		}
	
	});
	setTimeout(function(){instance.update(instance)}, 1000/instance.f_rate);
	this.show_obj_number();
}

SwipeObjControl.prototype.set_pos = function(jq_obj, x, y) {
	// global 座標から　localへ変換
	var local_x = x - this.local_world.pos.x;
	var local_y = y - this.local_world.pos.y;
	jq_obj.css("top",  local_y + "px");
	jq_obj.css("left",  local_x + "px");
}

SwipeObjControl.prototype.push_obj = function(obj_info) {
	var max_id = 1;
	for(let id in this.swipe_objs){
		if(id > max_id){
			max_id = id;
		}
	}
	this.add_obj(max_id + 1, obj_info);
	return max_id + 1;
}

// objを追加する
SwipeObjControl.prototype.add_obj = function(obj_id, obj_info) {
	console.log("add_obj" + this.obj_class );
	this.swipe_objs[obj_id] = obj_info;
	var swipe_obj = $("<div class='swipe-ball swipe-obj'></div>");
	swipe_obj.on("mousedown", {instance: this}, this.mdown);
    swipe_obj.on("touchstart", {instance: this}, this.mdown);
	swipe_obj.attr("obj-id", obj_id);
	this.swipe_area.append(swipe_obj);

}

// 場にあるswipe_objectの数　ただしidの最大ではない
SwipeObjControl.prototype.obj_number = function() {
	return Object.keys(this.swipe_objs).length;
} 

SwipeObjControl.prototype.show_obj_number = function(instance) {
	$("#obj-number").text(this.obj_number());
}

SwipeObjControl.prototype.startWithUserId = function(user_id) {
	this.user_id = user_id;
	if(user_id == 1){
		this.local_world.pos = {x:0, y:0};
		var obj_info = {vx: 0, vy : 0, xp: 200, yp: 200};
		this.push_obj(obj_info);
		this.get_world_info_flg = true;
	}else if(user_id == 2){
		this.local_world.pos = {x:500, y:0};
		this.send_my_enter_info();
	}
	console.log("start " + user_id);
	var instance = this;
	setTimeout(function(){instance.update(instance)}, 1000/this.f_rate);

}

SwipeObjControl.prototype.send_obj_info = function(obj_id) {
	var msg_obj = {};
	msg_obj.objs = {};
	msg_obj.type = "objs_info";
	if(obj_id){
		console.log("send obj info")
		console.log(obj_id);
		console.log(this.swipe_objs);
		msg_obj.objs[obj_id] = this.swipe_objs[obj_id];
	}else{
		console.log(this.swipe_objs);
		msg_obj.objs = this.swipe_objs;
	}
	var json_obj = JSON.stringify(msg_obj);
	console.log(json_obj);
	this.send_msg_func(json_obj);
}

SwipeObjControl.prototype.send_my_enter_info = function() {
	msg_obj = {type: "enter", user_id: this.user_id};
	this.send_msg_func(JSON.stringify(msg_obj));
}

// 他でバイスからメッセージを受け取る
SwipeObjControl.prototype.get_msg = function(msg) {
	var msg_obj = JSON.parse(msg);
	console.log(msg);
	if(msg_obj.type === "objs_info"){ //追加するobj情報// 参加者への初期情報もこれで伝える
		for(var obj_id in msg_obj.objs){
			if(this.swipe_objs[obj_id]){ // 存在する場合は更新
				this.swipe_objs[obj_id] = msg_obj.objs[obj_id];
			}else{ // ない場合は追加
				this.add_obj(obj_id,  msg_obj.objs[obj_id]);
			}
		}
		if(this.get_world_info_flg == false){
			this.get_world_info_flg = true;
			var obj_info = {vx: 0, vy : 0, xp: 200, yp: 200};
			var obj_id = this.push_obj(obj_info);
			this.send_obj_info(obj_id);
		}
	}else if(msg_obj.type === "enter"){ // 新規加入者がはいってきた
		console.log("get msg enter");
		if(this.user_id == 1){
			console.log("send obj info first");
			this.send_obj_info();
		}
	}
}