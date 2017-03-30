var NCMBFile = function(){
	let NCMB_APPLICATION_KEY = "b9798e8289d5a52d1d31ffdfd5f611e47bbda2aa788d642a17ffdb680cba75d5";
	let NCMB_CLIENT_KEY = "0f274a91a284bdee9ba3a63b19c4b8d44f4f7e34fb63f19ddf4017b9e94845d0";
	let APPLICATION_ID = "W6t1v9GpgFpAuYvH";
	let ncmb = new NCMB(NCMB_APPLICATION_KEY, NCMB_CLIENT_KEY);

	this.upload = function(fileName, fileData){
		ncmb.File.upload(fileName, fileData)
	        .then(function(res){
	          // アップロード後処理
	        })
	        .catch(function(err){
	          // エラー処理
	        });	
	};

	this.getFile = function(fileName, $dom){
		/*
		ncmb.File.download(fileName)
    		.then(function(fileData){
      			// ファイル取得後処理
     			$dom.attr("src", fileData);
     		})
    		.catch(function(err){
     		// エラー処理
     			console.warn(err);
     		});
		*/

		let endPoint = "https://mb.api.cloud.nifty.com/";
		let src = `${endPoint}2013-09-01/applications/${APPLICATION_ID}/publicFiles/${fileName}`;
		console.log(src);
		$dom.attr("src", src);
	};


}