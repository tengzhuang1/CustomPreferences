// eslint-disable-next-line
// @ts-nocheck
ModulesManager.define(
	[],
	'aras.innovator.core.ItemWindow/DefaultItemWindowView',
	function () {
		function DefaultItemWindowView(inDom, inArgs) {
			this.inDom = inDom;
			this.inArgs = inArgs;

			if (!inDom) {
				return;
			}

			const arasObj = aras;
			const itemTypeName = inDom.getAttribute('type');
			let showSSVCSidebar = false;
			if (inArgs.viewMode === 'new') {
				showSSVCSidebar = arasObj.isNeedToDisplaySSVCSidebar(inDom, 'add');
			} else {
				const isEditMode =
					arasObj.isTempEx(inDom) ||
					(arasObj.isLockedByUser(inDom) && arasObj.isEditStateEx(inDom));
				showSSVCSidebar = arasObj.isNeedToDisplaySSVCSidebar(
					inDom,
					isEditMode ? 'edit' : 'view'
				);
			}
			if (!showSSVCSidebar) {
				this.isSSVCEnabled = false;
				return;
			}

			const itemTypeNd = arasObj.getItemTypeNodeForClient(itemTypeName);
			if (!itemTypeNd) {
				arasObj.AlertError(
					arasObj.getResource(
						'',
						'ui_methods_ex.item_type_not_found',
						itemTypeName
					)
				);
				return null;
			}
			const discussionTemplates = itemTypeNd.selectSingleNode(
				"Relationships/Item[@type='DiscussionTemplate']"
			);
			if (discussionTemplates) {
				this.isSSVCEnabled = true;
				return;
			}

			const itemID = inDom.getAttribute('id');
			const itemConfigID = inDom.selectSingleNode('config_id');
			let checkSSVC = arasObj.IomInnovator.newItem(
				itemTypeName,
				'VC_IsSSVCEnabledForItem'
			);
			checkSSVC.setID(itemID);
			if (itemConfigID) {
				checkSSVC.setProperty('config_id', itemConfigID.text);
			}
			checkSSVC = checkSSVC.apply();
			const resultNode = checkSSVC.dom.selectSingleNode('//Result');

			this.isSSVCEnabled = resultNode && resultNode.text === 'true';
		}

		DefaultItemWindowView.prototype = {};

		DefaultItemWindowView.prototype.getWindowProperties = function () {
			const inArgs = this.inArgs;
			const itemNd = this.inDom;
			const arasObj = aras;
			const isNew = inArgs.viewMode === 'new';
			const itemTypeName = itemNd.getAttribute('type');
			const scrH = screen.availHeight;
			const scrW = screen.availWidth;
			const itemTypeNd = arasObj.getItemTypeNodeForClient(itemTypeName);
			if (!itemTypeNd) {
				arasObj.AlertError(
					arasObj.getResource(
						'',
						'ui_methods_ex.item_type_not_found',
						itemTypeName
					)
				);
				return null;
			}

			//Modify by tz 2022/4/24 自动锁定
			// const isEditMode =
			// 	arasObj.isTempEx(itemNd) ||
			// 	(arasObj.isLockedByUser(itemNd) && arasObj.isEditStateEx(itemNd));
			const isEditMode = (arasObj.isTempEx(itemNd) ||(arasObj.isLockedByUser(itemNd) && arasObj.isEditStateEx(itemNd))) || (this.isAutoLock()&&this.canLockItemByUser());
			//End Modify
			const formType = isNew ? 'add' : isEditMode ? 'edit' : 'view';
			const formID = arasObj.uiGetFormID4ItemEx(itemNd, formType);
			const formNd = formID ? arasObj.getFormForDisplay(formID).node : null;
			const formH = formNd
				? parseInt(arasObj.getItemProperty(formNd, 'height'))
				: 50;
			const formW = formNd
				? parseInt(arasObj.getItemProperty(formNd, 'width'))
				: 784;

			const padding = 50;

			return {
				height: scrH - padding,
				width: scrW - padding,
				x: padding / 2,
				y: padding / 2,
				formHeight: formH,
				formWidth: formW
			};
		};

		DefaultItemWindowView.prototype.getWindowArguments = function () {
			let itemNd = this.inDom;
			const arasObj = aras;
			const itemTypeName = itemNd.getAttribute('type');
			const itemTypeNd = arasObj.getItemTypeNodeForClient(itemTypeName);
			if (!itemTypeNd) {
				arasObj.AlertError(
					arasObj.getResource(
						'',
						'ui_methods_ex.item_type_not_found',
						itemTypeName
					)
				);
				return null;
			}

			//Modify by tz 2022/4/24 自动锁定
			// const isEditMode =
			// 	arasObj.isTempEx(itemNd) ||
			// 	(arasObj.isLockedByUser(itemNd) && arasObj.isEditStateEx(itemNd));
			let isEditMode = arasObj.isTempEx(itemNd) ||(arasObj.isLockedByUser(itemNd) && arasObj.isEditStateEx(itemNd));
			if (this.isAutoLock() && this.canLockItemByUser()) {
				itemNd = this.lockItem();
				if (!itemNd) {
					return null;
				}
				isEditMode=true;
			}
			//End Modify
			const itemID = itemNd.getAttribute('id');
			const isNew =
				itemNd.getAttribute('action') == 'add' &&
				itemNd.getAttribute('isTemp') == '1'
					? true
					: false;
			const keyedName = arasObj.getKeyedNameEx(itemNd);
			const itemTypeLabel =
				arasObj.getItemProperty(itemTypeNd, 'label') || itemTypeName;

			let viewType = 'tab';
			if (itemTypeName == 'Report') {
				viewType = 'reporttool';
			} else if (itemTypeName == 'Method') {
				viewType = 'methodeditor';
			}

			const tmpKey = isEditMode
				? 'ui_methods_ex.itemtype_label_item_keyed_name'
				: 'ui_methods_ex.itemtype_label_item_keyed_name_readonly';
			const title = arasObj.getResource('', tmpKey, itemTypeLabel, keyedName);
			const databaseName = arasObj.getDatabase();

			return {
				isSSVCEnabled: this.isSSVCEnabled,
				item: itemNd,
				itemID: itemID,
				itemTypeName: itemTypeName,
				itemType: itemTypeNd,
				itemTypeLabel: itemTypeLabel,
				title: title,
				viewType: viewType,
				databaseName: databaseName,
				isNew: isNew,
				viewMode: 'tab view',
				isEditMode: isEditMode,
				reserveSpaceForSidebar: this.isSSVCEnabled
			};
		};

		DefaultItemWindowView.prototype.getViewUrl = function () {
			return '/Modules/aras.innovator.core.ItemWindow/cuiTabItemView';
		};

		DefaultItemWindowView.prototype.getWindowUrl = function (formHeight) {
			const arasObj = aras;
			const itemTypeName = this.inDom.getAttribute('type');
			const itemTypeNd = arasObj.getItemTypeNodeForClient(itemTypeName);
			if (!itemTypeNd) {
				arasObj.AlertError(
					arasObj.getResource(
						'',
						'ui_methods_ex.item_type_not_found',
						itemTypeName
					)
				);
				return null;
			}

			return arasObj.getBaseURL() + this.getViewUrl();
		};

		//Add by tz 2022/4/24 自动锁定
		//检查是否有开启自动锁定
		DefaultItemWindowView.prototype.isAutoLock = function () {
			return aras.getPreferenceItemProperty('Core_GlobalLayout', null, 'hl_core_auto_lock') == '1';
		}

		//检查是否有权限锁定当前对象
		DefaultItemWindowView.prototype.canLockItemByUser = function () {
			const itemNd = this.inDom;

			// if (aras.getPreferenceItemProperty('Core_GlobalLayout', null, 'hl_core_auto_lock') != '1') {
			// 	return aras.isTempEx(itemNd) || (aras.isLockedByUser(itemNd) && aras.isEditStateEx(itemNd));
			// }

			// if (aras.isTempEx(itemNd)) return true;
			// if (aras.getItemProperty(itemNd, 'is_current') != '1') return false;

			// const locked_by_id = aras.getItemProperty(itemNd, 'locked_by_id', '');
			// if (locked_by_id == '') {
			// 	return aras.getPermissions('can_update', itemNd.getAttribute('id'), "", itemNd.getAttribute('type'));
			// }

			// return locked_by_id == aras.getCurrentUserID();

			return aras.getPermissions('can_update', itemNd.getAttribute('id'), "", itemNd.getAttribute('type'));
		}

		//锁定当前对象
		DefaultItemWindowView.prototype.lockItem = function () {
			let itemNd = this.inDom;
			const itemTypeName=itemNd.getAttribute('type');
			const itemNodeId=itemNd.getAttribute('id');
			const actions = window.aras.getMainWindow().store.boundActionCreators;

			if(aras.isTempEx(itemNd)){
				return itemNd;
			}else if(aras.isLockedByUser(itemNd)){
				actions.createItemLocalChangesRecord(itemTypeName, itemNodeId, { '@isClaimed': true });
				return itemNd;
			}

			itemNd = aras.lockItemEx(itemNd);
			if(itemNd){
				itemNd.setAttribute('isEditState', '1')
				actions.createItemLocalChangesRecord(itemTypeName, itemNodeId, { });
			}
			return itemNd;
		}
		//End Add

		return DefaultItemWindowView;
	}
);
