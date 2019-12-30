'use strict';
//Prominently changed this file....
/*
* Based on: 
* Identity example in Chrome Apps Samples 
* https://github.com/GoogleChrome/chrome-app-samples/tree/master/samples/identity 
* https://github.com/GoogleChrome/chrome-app-samples/blob/master/LICENSE
*
And with the help of Mashe Hawskey blog 
https://mashe.hawksey.info/2017/05/using-the-google-apps-script-execution-api-in-chrome-extensions/
and git https://github.com/mhawksey/Example-Google-Apps-Script-Execution-API-integration-in-Chrome-Extension

*/

//Since, in manifest.json files every piece of code needs to be inside a function, it is done
//way it is done.
//Go throuh this GitHub gist to get into context https://gist.github.com/maxogden/4bed247d9852de93c94c
//var variavle = (function(){})() : The Syntax...

//Please Keep in mind that Apps Script API and Execution API, mean the same thing...
var writeToGoogleDocsFromChromeExtension = (function() {

	var SCRIPT_ID='1Z_pA3wcwevHgHsN8ivLtBAKF-ovP-_FTUuZ8qiRfQeMgcfQDgoTKkM45'; // Apps Script script id
	var STATE_START=1;
	var STATE_ACQUIRING_AUTHTOKEN=2;
	var STATE_AUTHTOKEN_ACQUIRED=3;

	var state = STATE_START;

	var signin_button, xhr_button, revoke_button, exec_info_div, exec_data, exec_result;
//function to disable any given button
	function disableButton(button) {
		button.setAttribute('disabled', 'disabled');
	}
//remove the 'disabled' attribute of a button, since in popup.html file every button has 'disabled' attribute
//predefined.
	function enableButton(button) {
		button.removeAttribute('disabled');
	}
//function to change states..
	function changeState(newState) {
		state = newState;
		switch (state) {
		  case STATE_START:
			enableButton(signin_button);
			disableButton(xhr_button);
			disableButton(revoke_button);
			break;
		  case STATE_ACQUIRING_AUTHTOKEN:
			// sampleSupport.log('Acquiring token...');
			disableButton(signin_button);
			disableButton(xhr_button);
			disableButton(revoke_button);
			break;
		  case STATE_AUTHTOKEN_ACQUIRED:
			disableButton(signin_button);
			enableButton(xhr_button);
			enableButton(revoke_button);
			break;
		}
	}
	/**
	 * Get users access_token.
	 *
	 * @param {object} options
	 *   @value {boolean} interactive - If user is not authorized ext, should auth UI be displayed.
	 *   @value {function} callback - Async function to receive getAuthToken result.
	 */

//Go through this link - https://developer.chrome.com/apps/identity, to get into context about
//chrome.identity.getAuthToken, and it's arguments...
	function getAuthToken(options) {
		chrome.identity.getAuthToken({ 'interactive': options.interactive }, options.callback);
	}

	/**
	 * Get users access_token in background with now UI prompts.
	 */
//The identity API tries to find the token in the cache, and if it exists it automatically handles
//authentication in the background. That is the reason why interactive is set to false.
	function getAuthTokenSilent() {
		getAuthToken({
			'interactive': false,
			'callback': getAuthTokenCallback,
		});
	}
	
	/**
	 * Get users access_token or show authorize UI if access has not been granted.
	 */
	function getAuthTokenInteractive() {
		getAuthToken({
			'interactive': true,
			'callback': getAuthTokenCallback,
		});
	}
	
	/**
	 * Handle response from authorization server.
	 *
	 * @param {string} token - Google access_token to authenticate request with.
	 */


	//This function is solely to change the states of buttons.......... and act as a call back function to
	//the two above functions
	function getAuthTokenCallback(token) {
		// Catch chrome error if user is not authorized.
		if (chrome.runtime.lastError) {
			// sampleSupport.log('No token acquired'); 
			changeState(STATE_START);
		} else {
			// sampleSupport.log('Token acquired');
			changeState(STATE_AUTHTOKEN_ACQUIRED);
		}
	}
	
	/**
	 * Calling the Execution API script.
	 */
//StraightForward..
	function sendDataToExecutionAPI() {
		disableButton(xhr_button);
		xhr_button.className = 'loading';
		getAuthToken({
			'interactive': false,
			'callback': sendDataToExecutionAPICallback,
		});
	}
	
	/**
	 * Calling the Execution API script callback.
	 * @param {string} token - Google access_token to authenticate request with.
	 */

	 //post is a function we have defined elsewhere in the program, and url, etc... are arguments we
	 //pass to the instance of XMLHttpRequest object in-built in every modern browser..
	function sendDataToExecutionAPICallback(token) {
		// sampleSupport.log('Sending data to Execution API script');
		post({	'url': 'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID + ':run',
				'callback': executionAPIResponse,
				'token': token,
				'request': {'function': 'createAndSendDocument',
							'parameters': {'data':exec_data.value}}
			});
	}

	/**
	 * Handling response from the Execution API script.
	 * @param {Object} response - response object from API call
	 */
//StraightForward. Might Remove Later.
	function executionAPIResponse(response){
		// sampleSupport.log(response);
		enableButton(xhr_button);
		xhr_button.classList.remove('loading');
		var info;
		if (response.response.result.status == 'ok'){
			info = 'Data has been entered into <a href="'+response.response.result.doc+'" target="_blank"><strong>this sheet</strong></a>';
		} else {
			info = 'Error...';
		}
		exec_result.innerHTML = info;
	}
	
	/**
	 * Revoking the access token.
	 */
	//Interesting observation here. I can set the inner HTML of variables defined in this JS file, but are
	//ID's of some elements in the html file. Edit: Sorry erroeous observation, They are indeed defined 
	//using querySelectors.
	function revokeToken() {
		exec_result.innerHTML='';
		getAuthToken({
			'interactive': false,
			'callback': revokeAuthTokenCallback,
		});
	}
	
	/**
	 * Revoking the access token callback
	 */
	function revokeAuthTokenCallback(current_token) {
		if (!chrome.runtime.lastError) {

			// Remove the local cached token
			chrome.identity.removeCachedAuthToken({ token: current_token }, function() {});
			
			// Make a request to revoke token in the server
			var xhr = new XMLHttpRequest();
			xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' +
				   current_token);
			xhr.send();

			// Update the user interface accordingly
			changeState(STATE_START);
			// // sampleSupport.log('Token revoked and removed from cache. '+
			// 				'Check chrome://identity-internals to confirm.');
		}
	
	}
	
	/**
	 * Make an authenticated HTTP POST request.
	 *
	 * @param {object} options
	 *   @value {string} url - URL to make the request to. Must be whitelisted in manifest.json
	 *   @value {object} request - Execution API request object
	 *   @value {string} token - Google access_token to authenticate request with.
	 *   @value {function} callback - Function to receive response.
	 */
	function post(options) {
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			
			if (xhr.readyState === 4 && xhr.status === 200) {
				// JSON response assumed. Other APIs may have different responses.
				options.callback(JSON.parse(xhr.responseText));
			} else if(xhr.readyState === 4 && xhr.status !== 200) {
				// sampleSupport.log('post', xhr.readyState, xhr.status, xhr.responseText);
			}
		};
		xhr.open('POST', options.url, true);
		// Set standard Google APIs authentication header.
		xhr.setRequestHeader('Authorization', 'Bearer ' + options.token);
		xhr.send(JSON.stringify(options.request));
	}

	return {
		onload: function () {
			signin_button = document.querySelector('#signin');
			signin_button.addEventListener('click', getAuthTokenInteractive);

			xhr_button = document.querySelector('#getxhr');
			xhr_button.addEventListener('click', sendDataToExecutionAPI.bind(xhr_button, true));

			revoke_button = document.querySelector('#revoke');
			revoke_button.addEventListener('click', revokeToken);

			exec_info_div = document.querySelector('#exec_info');
			exec_data = document.querySelector('#exec_data');
			exec_result = document.querySelector('#exec_result')

			// Trying to get access token without signing in, 
			// it will work if the application was previously 
			// authorized by the user.
			getAuthTokenSilent();
		}
	};

})();
//Haaaaa.. The onload method inside the anonymous function which is equated to WritetoGoogleDocs.... variable
//is called everytime window is onloaded.....
window.onload = writeToGoogleDocsFromChromeExtension.onload;
