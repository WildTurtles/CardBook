if ("undefined" == typeof(wdw_findDuplicates)) {
	Components.utils.import("resource://gre/modules/Services.jsm");
	Components.utils.import("chrome://cardbook/content/cardbookRepository.js");

	var wdw_findDuplicates = {
		
		gResults: [],
		gResultsDirPrefId: [],
		gDynamicCss: {},
		gHideForgotten: true,

		deleteCssAllRules: function (aStyleSheet) {
			for (var i = wdw_findDuplicates.gDynamicCss[aStyleSheet.href].length - 1 ; i >= 0; i--) {
				try {
					aStyleSheet.deleteRule(wdw_findDuplicates.gDynamicCss[aStyleSheet.href][i]);
				} catch(e) {}
			}
			wdw_findDuplicates.gDynamicCss[aStyleSheet.href] = [];
		},

		createCssTextBoxRules: function (aStyleSheet, aDirPrefId, aColor, aColorProperty) {
			var ruleString = ".cardbookFindDuplicatesClass textbox[findDuplicates=color_" + aDirPrefId + "] {-moz-appearance: none !important; " + aColorProperty + ": " + aColor + " !important; border: 1px !important;}";
			var ruleIndex = aStyleSheet.insertRule(ruleString, aStyleSheet.cssRules.length);
			wdw_findDuplicates.gDynamicCss[aStyleSheet.href].push(ruleIndex);
		},

		loadCssRules: function () {
			for (var prop in document.styleSheets) {
				var styleSheet = document.styleSheets[prop];
				if (styleSheet.href == "chrome://cardbook/skin/findDuplicates.css") {
					if (!(wdw_findDuplicates.gDynamicCss[styleSheet.href])) {
						wdw_findDuplicates.gDynamicCss[styleSheet.href] = [];
					}
					wdw_findDuplicates.deleteCssAllRules(styleSheet);
					for (var i = 0; i < wdw_findDuplicates.gResultsDirPrefId.length; i++) {
						var dirPrefId = wdw_findDuplicates.gResultsDirPrefId[i];
						var color = cardbookPreferences.getColor(dirPrefId)
						var useColor = cardbookPreferences.getStringPref("extensions.cardbook.useColor");
						if (useColor == "text") {
							var colorProperty = "color";
						} else {
							var colorProperty = "background-color";
						}
						wdw_findDuplicates.createCssTextBoxRules(styleSheet, dirPrefId, color, colorProperty);
					}
					cardbookRepository.reloadCss(styleSheet.href);
				}
			}
		},

		generateCardArray: function (aCard) {
			try {
				var myResultTry = [];
				var myResultSure = [];
				var myFields = [ "firstname" , "lastname" ];
				for (var i = 0; i < myFields.length; i++) {
					if (aCard[myFields[i]] != "") {
						myResultTry.push(aCard[myFields[i]].replace(/([\\\/\:\*\?\"\'\-\<\>\| ]+)/g, "").replace(/([0123456789]+)/g, "").toLowerCase());
					}
				}
				for (var i = 0; i < aCard.email.length; i++) {
					var myCleanEmail = aCard.email[i][0][0].replace(/([\\\/\:\*\?\"\'\-\<\>\| ]+)/g, "").replace(/([0123456789]+)/g, "").toLowerCase();
					var myEmailArray = myCleanEmail.split("@");
					var myEmailArray1 = myEmailArray[0].replace(/([^\+]*)(.*)/, "$1").split(".");
					myResultTry = myResultTry.concat(myEmailArray1);
					myResultSure.push(myCleanEmail);
				}
				for (var i = 0; i < aCard.tel.length; i++) {
					var myTel = cardbookUtils.formatTelForSearching(aCard.tel[i][0][0]);
					if (myTel != "") {
						myResultSure.push(myTel);
					}
				}
				myResultSure.push(aCard.uid);
				myResultTry = cardbookRepository.arrayUnique(myResultTry);
				return {resultTry : myResultTry, resultSure : myResultSure};
			}
			catch (e) {
				wdw_cardbooklog.updateStatusProgressInformation("wdw_findDuplicates.generateCardArray error : " + e, "Error");
			}
		},

		compareCardArrayTry: function (aArray1, aArray2) {
			try {
				if (aArray1.length == 1) {
					if (aArray2.length != 1) {
						return false;
					} else if (aArray1[0] == aArray2[0]) {
						return true;
					} else {
						return false;
					}
				} else {
					var count = 0;
					for (var i = 0; i < aArray1.length; i++) {
						for (var j = 0; j < aArray2.length; j++) {
							if (aArray1[i] == aArray2[j]) {
								count++;
								break;
							}
						}
						if (count == 2) {
							return true;
						}
					}
				}
				return false;
			}
			catch (e) {
				wdw_cardbooklog.updateStatusProgressInformation("wdw_findDuplicates.compareCardArrayTry error : " + e, "Error");
			}
		},

		compareCardArraySure: function (aArray1, aArray2) {
			try {
				for (var i = 0; i < aArray1.length; i++) {
					for (var j = 0; j < aArray2.length; j++) {
						if (aArray1[i] == aArray2[j]) {
							return true;
							break;
						}
					}
				}
				return false;
			}
			catch (e) {
				wdw_cardbooklog.updateStatusProgressInformation("wdw_findDuplicates.compareCardArraySure error : " + e, "Error");
			}
		},

		compareCards: function (aDirPrefId) {
			try {
				var myCardArray = [];
				wdw_findDuplicates.gResults = [];
				var myTmpResultDirPrefId = [];
				wdw_findDuplicates.gResultsDirPrefId = [];
				if (aDirPrefId != null && aDirPrefId !== undefined && aDirPrefId != "") {
					for (var i = 0; i < cardbookRepository.cardbookDisplayCards[aDirPrefId].length; i++) {
						var myCard = cardbookRepository.cardbookDisplayCards[aDirPrefId][i];
						if (!myCard.isAList) {
							myCardArray.push([wdw_findDuplicates.generateCardArray(myCard), myCard, true]);
						}
					}
				} else {
					for (i in cardbookRepository.cardbookCards) {
						var myCard = cardbookRepository.cardbookCards[i];
						if (!myCard.isAList) {
							myCardArray.push([wdw_findDuplicates.generateCardArray(myCard), myCard, true]);
						}
					}
				}
				
				for (var i = 0; i < myCardArray.length-1; i++) {
					var myTmpResult = [myCardArray[i][1]];
					for (var j = i+1; j < myCardArray.length; j++) {
						if (myCardArray[j][2] && wdw_findDuplicates.compareCardArrayTry(myCardArray[i][0].resultTry, myCardArray[j][0].resultTry)) {
							myTmpResult.push(myCardArray[j][1]);
							myCardArray[j][2] = false;
						} else if (myCardArray[j][2] && wdw_findDuplicates.compareCardArraySure(myCardArray[i][0].resultSure, myCardArray[j][0].resultSure)) {
							myTmpResult.push(myCardArray[j][1]);
							myCardArray[j][2] = false;
						}
					}
					if (myTmpResult.length > 1) {
						// necessary to sort for the excluded duplicates
						myTmpResult = cardbookUtils.sortCardsTreeArrayByString(myTmpResult, "uid", 1);
						wdw_findDuplicates.gResults.push(myTmpResult);
						myTmpResultDirPrefId = myTmpResultDirPrefId.concat(myTmpResult);
					}
				}
				for (var i = 0; i < myTmpResultDirPrefId.length; i++) {
					wdw_findDuplicates.gResultsDirPrefId.push(myTmpResultDirPrefId[i].dirPrefId);
				}
				wdw_findDuplicates.gResultsDirPrefId = cardbookRepository.arrayUnique(wdw_findDuplicates.gResultsDirPrefId);
			}
			catch (e) {
				wdw_cardbooklog.updateStatusProgressInformation("wdw_findDuplicates.compareCards error : " + e, "Error");
			}
		},
		
		createRow: function (aParent, aName, aHidden) {
			var aRow = document.createElement('row');
			aParent.appendChild(aRow);
			aRow.setAttribute('id', aName + 'Row');
			aRow.setAttribute('align', 'center');
			aRow.setAttribute('flex', '1');
			aRow.setAttribute('forget', aHidden.toString());
			if (wdw_findDuplicates.gHideForgotten && aRow.getAttribute('forget') == 'true') {
				aRow.hidden = true;
			} else {
				aRow.hidden = false;
			}
			// dirty hack to have the lines not shrinked on Linux only with blue.css
			aRow.setAttribute('style', 'min-height:36px;');
			return aRow
		},

		createTextbox: function (aRow, aName, aValue, aDirPrefId) {
			var aTextbox = document.createElement('textbox');
			aRow.appendChild(aTextbox);
			aTextbox.setAttribute('id', aName);
			aTextbox.setAttribute('value', aValue);
			aTextbox.setAttribute("findDuplicates", "color_" + aDirPrefId);
		},

		createMergeButton: function (aRow, aName, aLabel) {
			var aButton = document.createElement('button');
			aRow.appendChild(aButton);
			aButton.setAttribute('id', aName + 'Merge');
			aButton.setAttribute('label', aLabel);
			aButton.setAttribute('flex', '1');
			function fireButton(event) {
				var myId = this.id.replace(/Merge$/, "");
				var myArgs = {cardsIn: wdw_findDuplicates.gResults[myId], cardsOut: [], hideCreate: false, action: ""};
				var myWindow = window.openDialog("chrome://cardbook/content/wdw_mergeCards.xul", "", cardbookRepository.modalWindowParams, myArgs);
				var changed = false;
				if (myArgs.action == "CREATE") {
					var myNullCard = new cardbookCardParser();
					cardbookRepository.saveCard(myNullCard, myArgs.cardsOut[0], "cardbook.cardAddedIndirect");
					cardbookRepository.reWriteFiles([myArgs.cardsOut[0].dirPrefId]);
					changed = true;
				} else if (myArgs.action == "CREATEANDREPLACE") {
					var myNullCard = new cardbookCardParser();
					cardbookRepository.saveCard(myNullCard, myArgs.cardsOut[0], "cardbook.cardAddedIndirect");
					cardbookRepository.deleteCards(myArgs.cardsIn, "cardbook.cardRemovedDirect");
					cardbookRepository.reWriteFiles([myArgs.cardsOut[0].dirPrefId]);
					changed = true;
				}
				if (changed) {
					wdw_findDuplicates.load();
				}
			};
			aButton.addEventListener("click", fireButton, false);
			aButton.addEventListener("input", fireButton, false);
		},

		createForgetButton: function (aRow, aName, aLabel) {
			var aButton = document.createElement('button');
			aRow.appendChild(aButton);
			aButton.setAttribute('id', aName + 'Forget');
			aButton.setAttribute('label', aLabel);
			aButton.setAttribute('flex', '1');
			function fireButton(event) {
				var myId = this.id.replace(/Forget$/, "");
				cardbookDuplicate.updateDuplicate(wdw_findDuplicates.gResults[myId]);
				wdw_findDuplicates.load();
			};
			aButton.addEventListener("click", fireButton, false);
			aButton.addEventListener("input", fireButton, false);
		},

		displayResults: function () {
			cardbookElementTools.deleteRows('fieldsVbox');
			var aListRows = document.getElementById('fieldsVbox');
			var strBundle = document.getElementById("cardbook-strings");
			var buttonMergeLabel = strBundle.getString("mergeCardsLabel");
			var buttonForgetLabel = strBundle.getString("forgetCardsLabel");

			for (var i = 0; i < wdw_findDuplicates.gResults.length; i++) {
				var shouldBeForgotten = false;
				for (var j = 0; j < wdw_findDuplicates.gResults[i].length-1; j++) {
					var myCard = wdw_findDuplicates.gResults[i][j];
					if (cardbookRepository.cardbookDuplicateIndex[myCard.uid]) {
						for (var k = j+1; k < wdw_findDuplicates.gResults[i].length; k++) {
							if (cardbookRepository.cardbookDuplicateIndex[myCard.uid].includes(wdw_findDuplicates.gResults[i][k].uid)) {
								shouldBeForgotten = true;
								break;
							}
						}
					}
					if (shouldBeForgotten) {
						break;
					}
				}
				var aRow = wdw_findDuplicates.createRow(aListRows, i, shouldBeForgotten);
				for (var j = 0; j < wdw_findDuplicates.gResults[i].length; j++) {
					var myCard = wdw_findDuplicates.gResults[i][j];
					wdw_findDuplicates.createTextbox(aRow, i+"::"+j, myCard.fn, myCard.dirPrefId);
				}
				wdw_findDuplicates.createMergeButton(aRow, i, buttonMergeLabel);
				if (!shouldBeForgotten) {
					wdw_findDuplicates.createForgetButton(aRow, i, buttonForgetLabel);
				}
			}
			wdw_findDuplicates.showLabels();
		},

		showLabels: function () {
			var strBundle = document.getElementById("cardbook-strings");
			var i = 0;
			var noContacts = true;
			while (true) {
				if (document.getElementById(i + 'Row')) {
					var myRow = document.getElementById(i + 'Row');
					if (wdw_findDuplicates.gHideForgotten) {
						if (myRow.getAttribute('forget') == 'false') {
							noContacts = false;
							break;
						}
					} else {
						noContacts = false;
						break;
					}
					i++;
				} else {
					break;
				}
			}
			if (noContacts) {
				document.getElementById('noContactsFoundDesc').value = strBundle.getString("noContactsDuplicated");
				document.getElementById('noContactsFoundDesc').hidden = false;
			} else {
				document.getElementById('noContactsFoundDesc').hidden = true;
			}
			if (wdw_findDuplicates.gHideForgotten) {
				document.getElementById('hideOrShowForgottenLabel').setAttribute('label', strBundle.getString("showForgottenLabel"));
				document.getElementById('hideOrShowForgottenLabel').setAttribute('accesskey', strBundle.getString("showForgottenAccesskey"));
			} else {
				document.getElementById('hideOrShowForgottenLabel').setAttribute('label', strBundle.getString("hideForgottenLabel"));
				document.getElementById('hideOrShowForgottenLabel').setAttribute('accesskey', strBundle.getString("hideForgottenAccesskey"));
			}				
		},

		hideOrShowForgotten: function () {
			wdw_findDuplicates.gHideForgotten = !wdw_findDuplicates.gHideForgotten;
			var i = 0;
			while (true) {
				if (document.getElementById(i + 'Row')) {
					var myRow = document.getElementById(i + 'Row');
					if (wdw_findDuplicates.gHideForgotten && myRow.getAttribute('forget') == 'true') {
						myRow.hidden = true;
					} else {
						myRow.hidden = false;
					}
					i++;
				} else {
					break;
				}
			}
			wdw_findDuplicates.showLabels();
		},

		preload: function () {
			cardbookDuplicate.loadDuplicate();
		},

		load: function () {
			wdw_findDuplicates.compareCards(window.arguments[0].dirPrefId);
			wdw_findDuplicates.loadCssRules();
			wdw_findDuplicates.displayResults();
		},

		cancel: function () {
			cardbookRepository.cardbookDuplicateIndex = {};
			close();
		}

	};

};
