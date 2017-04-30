var NodeModule = function(node_list, connect_list){

    this.node = $(".node");
    this.node_count = 0;
    this.connect_count = 0;
    this.map_parent = $(".node-map");
    this.detail_node_id = 0;
    this.node_list = node_list;
    this.connect_list = connect_list;
    /*
    var node_list = [
        {type: "client", name: "webGL", pos: [487,516], is_active: true},
        {type: "server", name: "server", pos: [523,213], is_active: true},
        {type: "local", name: "image recognition", pos: [300, 227], is_active: true}, //3
        {type: "main-node", name: "main", pos: [260 ,338], is_active: true},
        {type: "local", name: "camera input", pos: [210, 440], is_active: true},//5
        {type: "control", name: "control panel", pos: [212,139], is_active: true},
        {type: "local", name: "wroom master", pos: [61, 396], is_active: true},
        {type: "local", name: "apery thread", pos: [69, 266], is_active: true}, //8
        {type: "control", name: "CGIHttpServer", pos: [174, 221], is_active: true},
        {type: "real-world", name: "webcam", pos: [219, 554], is_active: true},//10
        {type: "client", name: "wroom", pos: [73, 562], is_active: true},
        {type: "local", name: "DNN", pos: [323, 130], is_active: false}
    ];
    */

    this.init_nodes();
    /*
    var connect_list = [
        {nodes: [1,2]} , 
        {nodes: [2,4]},
        {nodes: [3,4]},
        {nodes: [4,5]},
        {nodes: [6,9]},
        {nodes: [4,7]},
        {nodes: [7,11]},
        {nodes: [4,8]},
        {nodes: [4,9]},
        {nodes: [3,12]},
        {nodes: [5,10]}
        ];
        */
    this.init_connects();
    // double click
    $(".node").on("dblclick", {my_node_obj: this},this.toggle_node);
    
    $("button.update-button").click(function(){
        // 単にサーバへデータをアクセスするのではなくリロードする（サーバのノードがおちててもキャッシュから拾われるっぽい）
        location.reload();
        //get_status();
    });

    $("button.clear-log").click(function(){
        node_list[detail_node_id - 1]["log"] = "";
        renown_node_detail(detail_node_id);
    });

    // ノード外を押すとfocus外す
    $(this.map_parent).click(() =>{
        this.renown_node_detail(0);
        this.click_callback(0);
        console.log("click");
    });
    
    this.is_update = false;
    if(this.is_update){
        // 定期的に状態取得
        this.get_status();
        setInterval(get_status, 1000);
    }
    /*
    //要素の取得
    var elements = document.getElementsByClassName("node");
    //マウスが要素内で押されたとき、又はタッチされたとき発火
    for(var i = 0; i < elements.length; i++) {
        elements[i].addEventListener("mousedown", mdown, false);
        elements[i].addEventListener("touchstart", mdown, false);
    }
    */
    var my_node_obj = this;
    $(".node").each(function(){
        $(this).on("mousedown", {my_node_obj: my_node_obj}, my_node_obj.mdown);
        $(this).on("touchstart", {my_node_obj, my_node_obj}, my_node_obj.mdown);
        $(this).click(function(e){
            e.stopPropagation(); //　親へのバブリングを停止して親要素のクリックイベントを発生させない
        })
    });


    //要素内のクリックされた位置を取得するグローバル（のような）変数
    var x;
    var y;

}

NodeModule.prototype.mdown = function(e){
    //クラス名に .drag を追加
    //this.classList.add("drag");
    $(this).addClass("drag");
    var instance = e.data.my_node_obj;
    var node_id = $(this).attr("node_id");
    e.data.my_node_obj.renown_node_detail(node_id);
    console.log(e);
    //タッチデイベントとマウスのイベントの差異を吸収
    if(e.type === "mousedown") {
        var event = e;
        } else {
        var event = e.originalEvent.changedTouches[0];
    }
    //要素内の相対座標を取得
    x = event.pageX - this.offsetLeft;
    y = event.pageY - this.offsetTop;
    //ムーブイベントにコールバック
    //document.body.addEventListener("mousemove", mmove, false);
    //document.body.addEventListener("touchmove", mmove, false);
    $(e.data.my_node_obj.map_parent).on("mousemove", {my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mmove);
    
    $(e.data.my_node_obj.map_parent).on("touchmove", {my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mmove);
    var drag = $(".drag");
    $(drag).on("mouseup", {my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mup);
    //document.body.addEventListener("mouseleave", mup, false);
    $(e.data.my_node_obj.map_parent).on("mouseleave",{my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mup);
    //drag.addEventListener("touchend", mup, false);
    $(drag).on("touchend", {my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mup);
    //document.body.addEventListener("touchleave", mup, false); 
    $(e.data.my_node_obj.map_parent).on("touchleave", {my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mup);

    if(instance.click_callback){
        instance.click_callback(node_id);
    }
}

//マウスカーソルが動いたときに発火
NodeModule.prototype.mmove = function(e) {
    //ドラッグしている要素を取得
    //var drag = document.getElementsByClassName("drag")[0];
    var drag = $(".drag");
    //同様にマウスとタッチの差異を吸収
    if(e.type === "mousemove") {
        var event = e;
    } else {
        var event = e.originalEvent.changedTouches[0];
    }
    //フリックしたときに画面を動かさないようにデフォルト動作を抑制
    e.preventDefault();
    //マウスが動いた場所に要素を動かす
    //drag.style.top = event.pageY - y + "px";
    //drag.style.left = event.pageX - x + "px";
    $(drag).css("top", event.pageY - y + "px");
    $(drag).css("left", event.pageX - x + "px");
    //line
    e.data.my_node_obj.update_connects();
    //マウスボタンが離されたとき、またはカーソルが外れたとき発火
    // drag.addEventListener("mouseup", mup, false);
     $(drag).mouseup({my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mup);
     //document.body.addEventListener("mouseleave", mup, false);
     $(e.data.my_node_obj.map_parent).bind("mouseleave", {my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mup);
     //drag.addEventListener("touchend", mup, false);
    $(drag).bind("touchend", {my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mup);
    //document.body.addEventListener("touchleave", mup, false); 
    $(e.data.my_node_obj.map_parent).bind("touchleave", {my_node_obj: e.data.my_node_obj}, e.data.my_node_obj.mup);
}

//マウスボタンが上がったら発火
NodeModule.prototype.mup = function(e) {
    //var drag = document.getElementsByClassName("drag")[0];
    var drag = $(".drag");
    //ムーブベントハンドラの消去
    //document.body.removeEventListener("mousemove", mmove, false);
    $(e.data.my_node_obj.map_parent).unbind("mousemove", e.data.my_node_obj.mmove);
    //drag.removeEventListener("mouseup", mup, false);
    $(drag).unbind("mouseup", e.data.my_node_obj.mup);
    //document.body.removeEventListener("touchmove", mmove, false);
    $(e.data.my_node_obj.map_parent).unbind("touchmove", e.data.my_node_obj.mmove);
    //drag.removeEventListener("touchend", mup, false);
    $(drag).unbind("touchend", e.data.my_node_obj.mup);
    //クラス名 .drag も消す
    //drag.classList.remove("drag");
    $(drag).removeClass("drag");
} 

NodeModule.prototype.get_status_callback = function(json){
    this.update_status(json);
}

NodeModule.prototype.send_panel = function(node_id){
    var url =  "/cgi-bin/panel.py?node_id=" + node_id;
    $.ajax({
        url: url,
        dataType: "jsonp",
        jsonpCallback: 'callback',
        timeout: 4000
    })
    .fail(function(){
        console.log("send_pamel failed");
    });
}

// サーバから状態の情報を定期的に取得
NodeModule.prototype.get_status = function(){
    var url =  '/cgi-bin/panel.py?get_status=1';
    var node_ids = [2, 3,4,5,7,8,10, 11,12]; // main からの応答がなくなった時にグレーアウトするノード
    $.ajax({
        url: url,
        dataType: "jsonp",
        jsonpCallback: 'get_status_callback',
        timeout: 4000
    })
    .done(function(){
        set_toggle_node(this.get_node_dom(4), true);
    })
    .fail(function(){
        console.log("get status failed");
        for (var i=0; i< node_ids.length; i++){
            set_toggle_node(this.get_node_dom(node_ids[i]), false);
        }
    });
}

NodeModule.prototype.get_node_dom = function(node_id){
    return $("#node" + node_id);
}

NodeModule.prototype.get_connect_dom = function(connect_id){
    return $("#line" + connect_id);
}

NodeModule.prototype.init_nodes = function(){
    for(var i=0; i<this.node_list.length; i++){
        if(this.node_list[i] != null){
            this.node_list[i]['log'] = "";
            this.create_node(this.node_list[i].type, this.node_list[i].name, this.node_list[i].pos);
        }else{
            this.node_count ++; // ファイルからデータ読み込んだ際にnode_id を一致させるため
        }
    }
}

NodeModule.prototype.create_node = function(node_type, txt, pos){
    var c_node = this.node.clone(true);
    this.node_count += 1;
    c_node.addClass(node_type);
    c_node.attr("id", "node" + this.node_count);
    c_node.attr("node_id", this.node_count);
    this.map_parent.append(c_node);
    c_node.children().text(txt);
    c_node.css("top", pos[1] ).css("left", pos[0] );
}

NodeModule.prototype.get_node_dom_pos = function(dom){
    return [dom.position().left , dom.position().top];
}
    
// 二点間直線
NodeModule.prototype.draw_line = function(start, goal){
    var line = $("<div class='line'></div>");
    this.redraw_line(start, goal, line);
    this.map_parent.append(line);
    return line;
}

NodeModule.prototype.redraw_line = function(start, goal, line){
    var d_x = goal[0] - start[0];
    var d_y = goal[1] - start[1];
    var len = Math.sqrt(d_x　* d_x + d_y * d_y);   
    if(d_x == 0){
        d_x = 0.1;
    }
    line.css("width", len);
    var deg = Math.atan(d_y/d_x) * 180.0 / Math.PI;
    //deg = 0;
    line.css("transform", "rotate(" + deg + "deg)");
    line.css("top", start[1] + d_y/2 + "px");
    line.css("left", start[0] + d_x/2 - len/2.0 + "px");
}

NodeModule.prototype.update_connects = function(){
    for(var i=0; i< this.connect_list.length; i++){
        if(this.connect_list[i] != null){
            this.redraw_connect(this.connect_list[i]);
        }
    }
}

NodeModule.prototype.init_connects = function(){
    for(var i=0; i< this.connect_list.length; i++){
        this.connect_count++;
        if(this.connect_list[i] != null){
            this.connect_list[i]['id'] = i+1;
            this.draw_connect(this.connect_list[i]);
        }
    }
}

NodeModule.prototype.draw_connect = function(con){
    var line = this.draw_line([0,0], [1,1]);
    line.attr("id", "line" + con.id);
    this.redraw_connect(con);
}
    
NodeModule.prototype.redraw_connect = function(con){
    var start_node = this.get_node_dom(con.nodes[0]); // $("#node" + con.nodes[0]);
    var goal_node =  this.get_node_dom(con.nodes[1]); //$("#node" + con.nodes[1]);
    var start = [$(start_node).position().left + $(start_node).width()/2.0, $(start_node).position().top + $(start_node).height()/2.0];
    var goal = [$(goal_node).position().left + $(goal_node).width()/2.0, $(goal_node).position().top + $(goal_node).height()/2.0];
    var line = this.get_connect_dom(con.id); //$("#line" + con.id);
    this.redraw_line(start, goal, line);
}

NodeModule.prototype.remove_connect = function(con){
    con.remove();
}

NodeModule.prototype.toggle_node = function(e){
    var node_id = $(this).attr("node_id");
    //e.data.my_node_obj.send_panel(node_id);
    //  set_toggle_node(node, !node_list[node_id - 1].is_active);
    if(e.data.my_node_obj.dbc_node){      
        e.data.my_node_obj.dbc_node(node_id);
    }
}

NodeModule.prototype.set_toggle_node = function(node, is_active){
    var blk_out = "black-out";
    var node_id = $(node).attr("node_id");
    if(is_active){
        $(node).removeClass(blk_out);
    }else{
        $(node).addClass(blk_out);
    } 
    node_list[node_id - 1].is_active = is_active;
    if(detail_node_id == node_id){
        $(".node-status").text( node_list[node_id - 1].is_active );
    }
    // 接続しているlineも対応
    var connects = find_connect_by_node_id(node_id);
    for(var i=0; i<connects.length; i++){
        var con_id = connects[i].id;
        var another_node_id = connects[i].nodes[0];
        if(another_node_id == node_id){
            another_node_id = connects[i].nodes[1];
        }
        if( node_list[node_id - 1].is_active){
            //相手がoffの時、lineもoffのまま
            if(node_list[another_node_id - 1].is_active){
                this.get_connect_dom(con.id).removeClass(blk_out);
            }
        }else{
            this.get_connect_dom(con.id).addClass(blk_out);
        }
    }
}

NodeModule.prototype.find_connect_by_node_id = function(node_id){
    var connects = {};
    for(var i=0; i<connect_list.length; i++){
        if(connect_list[i].nodes[0] == node_id || connect_list[i].nodes[1] == node_id ){
            connects[i+1] = connect_list[i];
        }
    }
    return connects;
}
    
NodeModule.prototype.renown_node_detail = function(node_id){
     if(this.detail_node_id != node_id || node_id == 0){
        this.get_node_dom(this.detail_node_id).removeClass("large");
        this.get_node_dom(node_id).addClass("large");
        this.detail_node_id = node_id;
        this.shadow_anim($(".node-detail"));
    }       
    if(node_id == 0){
        return;
    }

    $(".node-detail .node-name").text(this.node_list[node_id - 1].name);
    $(".node-status").text( this.node_list[node_id - 1].is_active );
    $(".node-log").text( this.node_list[node_id - 1]["log"]);
    $(".ban-capture").addClass("hidden");
   
}

NodeModule.prototype.shadow_anim = function(element, end_params, time = 1000){
    $(element).addClass("node-detail-init");
    setTimeout(function(){$(element).removeClass("node-detail-init");}, 100);
}

NodeModule.prototype.update_status = function(data){
    for (var i=0; i<data.length; i++){
        var node_id = data[i].node_id;
        set_toggle_node(this.get_node_dom(node_id), data[i].status == 1);
        if(data[i]["log"] != ""){
            this.node_list[i]["log"] += "\n" +  data[i]["log"];
        }
        if(detail_node_id == i+1){
            $(".node-log").text( this.node_list[i]["log"]);
        }
    } 
    var now = new Date().getTime();
    $('.ban-capture img').attr('src', 'capture.jpg?' + now);
}

/* 以下は編集用に追加した部分 */
NodeModule.prototype.create_new_node = function(node_data){
    node_data = node_data || {type: "", name: "", pos:[50,20]};
    this.node_list.push(node_data);
    this.create_node(node_data.node_type, node_data.name, node_data.pos);
    this.update_node_data(this.node_count, node_data);

}

NodeModule.prototype.create_new_connect = function(node_id1, node_id2){

}

NodeModule.prototype.update_node_data = function(node_id, node_data){
    var target_node_dom = this.get_node_dom(node_id)
    if(node_data.type){
        target_node_dom.removeClass(this.node_list[node_id - 1].type);
        this.node_list[node_id - 1].type = node_data.type;
        target_node_dom.addClass(node_data.type); 
    }
    if(node_data.name){  
        console.log(node_id);  
        this.node_list[node_id - 1].name = node_data.name;
        target_node_dom.children().text(node_data.name);
    }

    if("is_active" in node_data){
        var blk_out = "black-out";
        this.node_list[node_id - 1].is_active = node_data.is_active;
        if(node_data.is_active){
            target_node_dom.removeClass(blk_out);
        }else{
            target_node_dom.addClass(blk_out);
        }
    }
}

NodeModule.prototype.delete_node = function(node_id){
    var target_node_dom = this.get_node_dom(node_id)
    target_node_dom.remove();
    this.node_list[node_id-1] = null;

}

// 関係するラインも消去
NodeModule.prototype.delete_node_with_connects = function(node_id){
    this.delete_node(node_id);

    let connect_id_list = this.get_connect_id_list_by_node_id(node_id);
    console.log(connect_id_list);
    for(let connect_id of connect_id_list){
        this.delete_connect(connect_id);
    }
}

NodeModule.prototype.generate_connect = function(connect_data){ 
    connect_data.id = ++this.connect_count;
    this.connect_list.push(connect_data);
    console.log(connect_data);
    this.draw_connect(connect_data);
}

NodeModule.prototype.delete_connect = function(connect_id){ 
    this.remove_connect(this.get_connect_dom(connect_id));
    this.connect_list[connect_id -1] = null;
}

// 現在のノード、コネクトの状態をコードとして出力
NodeModule.prototype.generate_code = function(node_id, node_data){
    this.apply_position_to_node_data(); // pos を適用
    var code_text = "";
    code_text += "<script type=\"text/javascript\"> \n\n";
    code_text += "var node_list = [ \n";
    for(var index = 0; index < this.node_list.length; index++){
        let node_data = this.node_list[index];
        if(node_data != null){
            code_text += `      {type: "${node_data.type}", name: "${node_data.name}", pos: [${node_data.pos[0]}, ${node_data.pos[1]}]}, \n`;
        }else{
            code_text += "      null,\n";
        }
    }
    code_text += "];\n\n";
    code_text += "var connect_list = [ \n";
    for(var index = 0; index < this.connect_list.length; index++){
        let connect_data = this.connect_list[index];
        if(connect_data != null){
            code_text += `      {nodes: [${connect_data.nodes[0]}, ${connect_data.nodes[1]}]}, \n`;
        }else{
            code_text += "      null,\n";
        }
    }
    code_text += "]; \n";
    code_text += "</script>";
    return code_text;
}

NodeModule.prototype.focused_id = function(){
    return this.detail_node_id;
}

NodeModule.prototype.get_connect_id_list_by_node_id = function(node_id){
    var connect_id_list = [];
    for(var index=0; index <this.connect_list.length; index++){
        if(this.connect_list[index] == null){
            continue;
        }
        if(this.connect_list[index].nodes[0] == node_id ||
            this.connect_list[index].nodes[1] == node_id){
            connect_id_list.push(index + 1);
        }
    }
    return connect_id_list;
}

NodeModule.prototype.get_connect_id_by_node_ids = function(node_id1, node_id2){
    var connect_id = 0;
    for(var index = 0; index < this.connect_list.length; index++){
        if(this.connect_list[index] == null){
            continue;
        }
        if((this.connect_list[index].nodes[0] == node_id1 &&
            this.connect_list[index].nodes[1] == node_id2) ||
            (this.connect_list[index].nodes[0] == node_id2 &&
            this.connect_list[index].nodes[1] == node_id1)){
            connect_id = index + 1;
            break;
        }
    }
    return connect_id;
}

// node_list にposition 情報を更新する
NodeModule.prototype.apply_position_to_node_data = function(){
    for(let index =0; index<this.node_list.length; index++){
        let node_data = this.node_list[index];
        if(node_data != null){
            node_data.pos = this.get_node_dom_pos(this.get_node_dom(index + 1));
        }
    }
}

NodeModule.prototype.reload = function(){
    this.map_parent.html(""); //もとのノードを空に
    this.node_count = 0;
    this.connect_count = 0;
    this.init_nodes();
    this.init_connects();
}


/*
Object.defineProperty(NodeModule, "focused_id", {
    get: function focused_id() {
        return this.node_id;
    }
});*/