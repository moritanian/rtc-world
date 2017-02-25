//import MaterialDateTimePicker from 'material-datetime-picker';
//window.MaterialDatePicker = MaterialDatePicker;
var register = $("#register");
register.hide();
 var picker = new MaterialDatetimePicker({ 
    opendBy: "focus",
    format: 'd/MM/YY'})
      .on('submit', function(d) {
        console.log(d);
         unix_time = Date.parse(d)/1000;
        output.innerText = d;
      });

    var el = document.querySelector('.c-datepicker-btn');
    el.addEventListener('click', function() {
      picker.open();
    }, false);

const NO_USER_ID = "no-user-id";
var user_id = NO_USER_ID;
var user_data = {};
var unix_time = "";

var config = {
    apiKey: "AIzaSyCFO6UPeouZvEhY-GqZIYo1OkW3XeH6Mjo",
    authDomain: " rtc-world.firebaseapp.com",
    databaseURL: "https://rtc-world.firebaseio.com/",
    messagingSenderId: "341418178004",
    storageBucket: "rtc-world.appspot.com",
};
var app = firebase.initializeApp(config);
var db = app.database();
var ref = db.ref();

var add_notification = document.querySelector('#add-notification');
add_notification.addEventListener("click", function(){
    var title = $("#title").val();
    var content = $("#content").val();
    ref.child("notifications").push({
        user_id: user_id,
        time: unix_time,
        title: title,
        content: content
    });       
});

var get_user_data =function(){ 
    console.log("start register");
    if ('serviceWorker' in navigator) {
        //document.addEventListener('DOMContentLoaded', () => {
            console.log("dom");
            let d = new Date();
            navigator.serviceWorker.register('./service-worker.js?time=${d.getTime()}');
            navigator.serviceWorker.ready
                     .then((registration) => {
                         return registration.pushManager.subscribe({userVisibleOnly: true});
                     })
                     .then((subscription) => {
                        user_data.endpoint = subscription.endpoint;
                         var rawKey = subscription.getKey ? subscription.getKey('p256dh') : '';
                         user_data.key = rawKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey))) : '';
                
                         var rawAuthSecret = subscription.getKey ? subscription.getKey('auth') : '';
                         user_data.auth = rawAuthSecret ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuthSecret))) : '';
                
                         console.log(`GCM EndPoint is: ${subscription.endpoint}`);
                         console.log(`Auth is: ${user_data.auth}`);
                         console.log(`public key is: ${user_data.key}`);

                         ref.child("users").orderByChild("public_key").equalTo(user_data.key).on("value", function(snap){
                            var v = snap.val();
                            if(v){
                                console.log(v);
                                user_id = Object.keys(v)[0];
                                $(register).hide();
                                $("#log").text(`user_id: ${user_id}`);
                            }else{
                                $(register).show();
                                $("#register").on("click", function(){
                                    register_user();
                                });
                            }
                         });

                       
                       

                     })
                     .catch(console.error.bind(console));
            
            // navigator.serviceWorker.addEventListener('controllerchange', (e) => {
            //     console.log(e);
            //     console.log(navigator.serviceWorker.controller);
            // }, false);
        //}, false);
    }
}

var register_user = function(){
    if(user_id != NO_USER_ID){
        console.log("you have already register");
        return false;
    }
    user_id = ref.child("users").push().key;
    ref.child("users/" + user_id).update({
                            endpoint: user_data.endpoint,
                            auth   : user_data.auth,
                            public_key: user_data.key
                            });
    console.log(user_id);
    $("#log").text("登録されました！ user_id" + user_id);
}





get_user_data();

