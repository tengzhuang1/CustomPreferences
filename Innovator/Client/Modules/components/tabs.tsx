// eslint-disable-next-line
// @ts-nocheck
import SvgManager from '../core/SvgManager';
import DragController from './dragTabController';

const tabHelper = {
	controlByScroll: function (elem, movable) {
		const scrollRight =
			movable.scrollWidth - movable.offsetWidth - movable.scrollLeft;
		elem.classList.toggle('aras-tabs_moved-right', scrollRight > 0);
		elem.classList.toggle('aras-tabs_moved-left', movable.scrollLeft > 0);
	},
	scrollLeft: function (elem, movable) {
		movable.scrollLeft = Math.max(0, movable.scrollLeft - movable.clientWidth);
		elem.classList.toggle('aras-tabs_moved-left', movable.scrollLeft !== 0);
		elem.classList.add('aras-tabs_moved-right');
	},
	scrollRight: function (elem, movable) {
		const diffWidth = movable.scrollWidth - movable.clientWidth;
		movable.scrollLeft = Math.min(
			movable.scrollLeft + movable.clientWidth,
			diffWidth
		);
		elem.classList.toggle(
			'aras-tabs_moved-right',
			movable.scrollLeft !== diffWidth
		);
		elem.classList.add('aras-tabs_moved-left');
	},
	scrollIntoView: function (elem, movable, tab) {
		const tabStyle = window.getComputedStyle(tab);
		const leftMargin = parseInt(tabStyle.marginLeft);
		const rightMargin = parseInt(tabStyle.marginRight);
		const tabOffset = tab.offsetLeft - movable.offsetLeft;
		const rightOffset = tabOffset + tab.offsetWidth - movable.clientWidth;

		if (rightOffset + rightMargin - movable.scrollLeft > 0) {
			// Firefox and IE have float tab coordinates: adding 1px to fix offset and count right scrollLeft
			movable.scrollLeft = rightOffset + rightMargin + 1;
		} else if (tabOffset - leftMargin - movable.scrollLeft < 0) {
			movable.scrollLeft = tabOffset - leftMargin;
		}
	},
	scrollByTab: function (elem, movable, tab) {
		if (movable.scrollWidth !== movable.clientWidth) {
			tabHelper.scrollIntoView(elem, movable, tab);
			tabHelper.controlByScroll(elem, movable);
			tabHelper.scrollIntoView(elem, movable, tab);
		}
	}
};

const dispatchCustomEvent = (tabs, type, detail) => {
	const event = new CustomEvent(type, { detail });
	tabs.dispatchEvent(event);
};

const closeTab = function (tabInstance, tabId) {
	const itemData = tabInstance.data.get(tabId);
	if (itemData && itemData.closable) {
		tabInstance.removeTab(tabId);
	}
};

const focusTab = async function (tabs, id) {
	tabs.focusedTab = id;
	await tabs.render();
	tabs.scrollIntoView(id);
	const tab = tabs._elem.querySelector(`[data-id="${id}"]`);
	tab && tab.focus();
};

const close = function (tabInstance, event) {
	const target = event.target;

	if (target.className.includes('aras-icon-close')) {
		const tab = target.closest('li');

		if (tab) {
			const id = tab.getAttribute('data-id');
			closeTab(tabInstance, id);
			event.stopPropagation();
		}
	}
};

const wheelClose = function (tabInstance, event) {
	// Check if wheel(middle button) is clicked
	if (event.button === 1) {
		const tab = event.target.closest('li');
		if (!tab) {
			return;
		}
		const id = tab.getAttribute('data-id');
		document.body.focus();

		setTimeout(() => {
			closeTab(tabInstance, id);
		}, 0);
	}
};

function getImage(url) {
	const iconClass = 'aras-tabs__icon';
	return SvgManager.createInfernoVNode(url, { cssClass: iconClass });
}

function createListItemContent(item) {
	const content = [];
	if (item.image) {
		content.push(getImage(item.image));
	}
	if (item.closable) {
		content.push(
			<span className="aras-icon-close-block">
				<span className="aras-icon-close" />
			</span>
		);
	}
	return content;
}

function isDisabledOrHidden(tabInstance, id) {
	if (!id) {
		return false;
	}

	const tab = tabInstance.data.get(id);
	return !tab || tab.disabled || tab.hidden || !tabInstance.tabs.includes(id);
}

function BuildTab(props) {
	const item = props.item;
	if (item.hidden) {
		return null;
	}

	const idx = props.idx;
	const isSelected = props.selected === idx;
	const isFocused = props.focused === idx;
	const tabClass = 'aras-tabs__tab';
	const activeClass = isSelected ? ' aras-tabs__tab_active' : '';
	const closableClass = item.closable ? ' aras-tabs__tab_closable' : '';
	const disabledClass = item.disabled ? ' aras-tabs__tab_disabled' : '';
	const cssClass = item.cssClass ? ` ${item.cssClass}` : '';
	let classList = `${tabClass}${activeClass}${closableClass}${disabledClass}${cssClass}`;
	const listItem = {
		'data-id': idx,
		draggable: item.draggable,
		'aria-selected': isSelected,
		'aria-disabled': !!item.disabled,
		role: 'tab',
		tabindex: props.focused ? (isFocused ? '0' : '-1') : isSelected ? '0' : '-1'
	};
	const tabs = props.tabs;
	let itemContent = tabs.formatter(idx, props.data);
	const isCustomized = itemContent !== null;
	if (!isCustomized) {
		const label = item.label ? (
			<span className="aras-tabs__label" role="presentation">
				{item.label}
			</span>
		) : null;
		itemContent = [...createListItemContent(item), label];
	} else if (
		!(itemContent.flags && itemContent.type) &&
		!Array.isArray(itemContent)
	) {
		const cssClass = itemContent.cssClass ? ` ${itemContent.cssClass}` : '';
		classList = `${classList}${cssClass}`;
		itemContent = itemContent.children;
	}

	if (!props.useTooltip) {
		const tooltip = item.tooltip_template || item.label;
		if (tooltip) {
			listItem.title = tooltip;
		}
	} else if (!isCustomized) {
		itemContent = tabs._getTooltipTemplate(item, itemContent);
	}

	return (
		<li className={classList} {...listItem}>
			{itemContent}
		</li>
	);
}

const componentLifecycle = {
	onComponentShouldUpdate: function (lastProps, nextProps) {
		return (
			(lastProps.selected !== nextProps.selected &&
				(lastProps.selected === lastProps.idx ||
					nextProps.selected === nextProps.idx)) ||
			lastProps.item !== nextProps.item ||
			lastProps.focused !== nextProps.focused
		);
	}
};

export default class Tabs extends HyperHTMLElement {
	switcher = null;
	#selectTabData = null;

	constructor(props) {
		super(props);
		this.data = new Map();
		this.tabs = [];
		this._elem = this;
		this.draggableTabs = false;
		this.initialized = false;
		this.useTooltip = false;
		this.tooltipSettings = {
			tooltipPosition: 'top'
		};
	}

	static get booleanAttributes() {
		return ['useTooltip', 'vertical'];
	}

	_getImage(url) {
		return getImage(url);
	}
	makeScroll() {
		// Binded handlers
		const controlByScrollBinded = tabHelper.controlByScroll.bind(
			null,
			this._elem,
			this._movable
		);
		const moveScrollLeftBinded = tabHelper.scrollLeft.bind(
			null,
			this._elem,
			this._movable
		);
		const moveScrollRightBinded = tabHelper.scrollRight.bind(
			null,
			this._elem,
			this._movable
		);

		// Attach Events on elements
		this._elem.firstElementChild.addEventListener(
			'click',
			moveScrollLeftBinded
		);
		this._elem.lastElementChild.addEventListener(
			'click',
			moveScrollRightBinded
		);

		tabHelper.controlByScroll(this._elem, this._movable);

		const resizeObserver = new ResizeObserver(() => {
			this.scrollIntoView(this.selectedTab);
			controlByScrollBinded();
		});
		resizeObserver.observe(this);
	}
	removeTab(id) {
		const listItem = this.data.get(id);
		if (!listItem) {
			return Promise.resolve();
		}

		this.data.delete(id);

		if (this.selectedTab === id) {
			this._selectNextTab(listItem);
		}

		const itemIndex = this.tabs.indexOf(id);
		this.tabs.splice(itemIndex, 1);

		return this.render().then(() => {
			if (this._movable) {
				tabHelper.controlByScroll(this._elem, this._movable);
			}
		});
	}
	_selectNextTab(selectedTab) {
		const currentSelectedTabId = this.selectedTab;
		const siblingItemId = this.data.has(selectedTab.parentTab)
			? selectedTab.parentTab
			: null;
		this.selectTab(siblingItemId || this._getNextTabId());
		dispatchCustomEvent(this, 'select', {
			id: this.selectedTab,
			previousId: currentSelectedTabId
		});
	}
	_getNextTabId() {
		const selectableTabsId = this.tabs.filter(
			(tabId) => tabId === this.selectedTab || !isDisabledOrHidden(this, tabId)
		);

		const selectedTabIndex = selectableTabsId.indexOf(this.selectedTab);
		return (
			selectableTabsId[selectedTabIndex + 1] ||
			selectableTabsId[selectedTabIndex - 1] ||
			null
		);
	}
	makeSelectable() {
		const select = (event) => {
			if (event.button !== 0) {
				return;
			}

			const target = event.target;
			const tab = target.closest('.aras-tabs__tab');
			if (!tab) {
				return;
			}

			const previousSelectedTab = this.selectedTab;
			const id = tab.dataset.id;
			this.selectTab(id);
			if (this.selectedTab === previousSelectedTab) {
				return;
			}

			dispatchCustomEvent(this, 'select', {
				id: this.selectedTab,
				previousId: previousSelectedTab
			});
		};
		this._elem.addEventListener('click', select);
	}
	makeDraggable() {
		new DragController(this, tabHelper);
		this.draggableTabs = true;
	}
	connectKeyboard() {
		this.focusedTab = null;
		this.addEventListener('keydown', this._keyboardEventHandler.bind(this));
		this.addEventListener('focusout', (e) => {
			if (e.target.dataset && e.target.dataset.id === this.focusedTab) {
				focusTab(this, null);
			}
		});
	}
	async selectTab(id) {
		if (isDisabledOrHidden(this, id)) {
			return false;
		}
		this.selectedTab = this.focusedTab = id;
		this.#selectTabData = this.data.get(id);
		if (this.switcher) {
			this.switcher.activePaneId = id;
		}
		await this.render();
		this.scrollIntoView(id);

		//Add by tz 2022/6/16 切换Tab时刷新页面
		try{
			const proWin=window[id];
			if(proWin&&proWin.isItemWindow&&aras.getPreferenceItemProperty('Core_GlobalLayout', null, 'hl_core_auto_refresh') == '1'&&!aras.isDirtyEx(proWin.item)&&proWin.onRefresh){
				proWin.onRefresh();
			}
		}catch{}
		//End Add

		return true;
	}
	async _keyboardEventHandler(e) {
		if (!e.target.closest('[role="tablist"]')) {
			return;
		}

		const key = e.code;
		if (
			(this.vertical && ['ArrowLeft', 'ArrowRight'].includes(key)) ||
			(!this.vertical && ['ArrowUp', 'ArrowDown'].includes(key))
		) {
			return;
		}
		this.focusedTab = this.focusedTab || this.selectedTab;

		const focusedTabIndex = this.tabs.indexOf(this.focusedTab);
		let nextIndex;
		switch (key) {
			case 'ArrowUp':
			case 'ArrowLeft':
				e.preventDefault();
				nextIndex =
					focusedTabIndex - 1 >= 0 ? focusedTabIndex - 1 : this.tabs.length - 1;
				break;
			case 'ArrowDown':
			case 'ArrowRight':
				e.preventDefault();
				nextIndex =
					focusedTabIndex + 1 < this.tabs.length ? focusedTabIndex + 1 : 0;
				break;
			case 'Enter':
			case 'NumpadEnter':
			case 'Space': {
				e.preventDefault();
				const previousId = this.selectedTab;
				const result = await this.selectTab(this.focusedTab);
				if (result) {
					dispatchCustomEvent(this, 'select', {
						id: this.selectedTab,
						previousId
					});
				}
				break;
			}
			case 'Delete':
				e.stopPropagation();
				closeTab(this, this.focusedTab);
				break;
			case 'Home':
				e.preventDefault();
				nextIndex = 0;
				break;
			case 'End':
				e.preventDefault();
				nextIndex = this.tabs.length - 1;
				break;
		}
		if (nextIndex !== undefined) {
			focusTab(this, this.tabs[nextIndex]);
		}
	}
	setTabContent(id, props) {
		if (id) {
			const item = this.data.get(id);
			if (item) {
				this.data.set(id, Object.assign({}, item, props));
			}
			return this.render();
		}
		return this.renderPromise || Promise.resolve();
	}
	addTab(id, props, position = this.tabs.length) {
		if (!id) {
			return this.renderPromise || Promise.resolve();
		}
		this.tabs.splice(position, 0, id);
		this.data.set(id, {
			closable: false,
			parentTab: this.selectedTab,
			draggable: this.draggableTabs,
			...props
		});
		return this.render();
	}
	scrollIntoView(id) {
		if (!this._movable || !id) {
			return;
		}
		const tab = this._elem.querySelector(`[data-id="${id}"]`);
		if (tab) {
			tabHelper.scrollByTab(this._elem, this._movable, tab);
		}
	}
	async render() {
		if (this.renderPromise) {
			return this.renderPromise;
		}

		this.renderPromise = Promise.resolve();
		await this.renderPromise;

		if (isDisabledOrHidden(this, this.selectedTab)) {
			const selectedTab =
				this.data.get(this.selectedTab) || this.#selectTabData;
			this._selectNextTab(selectedTab);
		}

		const defaultProps = {
			data: this.data,
			selected: this.selectedTab,
			focused: this.focusedTab,
			tabs: this,
			tooltipSettings: this.tooltipSettings,
			useTooltip: this.useTooltip
		};
		const listItems = this.tabs.map((id) => {
			const props = {
				...defaultProps,
				idx: id,
				item: this.data.get(id)
			};
			return <BuildTab {...props} ref={{ ...componentLifecycle }} />;
		});

		const list = (
			<ul
				className="aras-tabs__list"
				role="group"
				onclick={close.bind({}, this)}
				onmousedown={wheelClose.bind({}, this)}
			>
				{listItems}
			</ul>
		);

		Inferno.render(list, this._movable || this._elem);
		this.renderPromise = null;
	}

	formatter() {
		return null;
	}

	on(eventType, callback) {
		const handler = (event) => {
			let tabId;
			if (event.detail && event.detail.id) {
				tabId = event.detail.id;
			} else {
				const target = event.target.closest('.aras-tabs__tab');
				tabId = target && target.dataset.id;
			}

			const tabItem = tabId && this.data.get(tabId);
			if (tabItem && !isDisabledOrHidden(this, tabId)) {
				callback(tabId, event);
			}
		};
		this._elem.addEventListener(eventType, handler);
		return () => {
			this._elem.removeEventListener(eventType, handler);
		};
	}
	connectedCallback() {
		if (!this.initialized) {
			if (this.hasAttribute('movable')) {
				this.html`
					<span class="aras-tabs-arrow"></span>
						<div class="aras-tabs__list-container"></div>
					<span class="aras-tabs-arrow"></span>
				`;

				this._movable = this._elem.querySelector('div');
				this.makeScroll();
			}
			this.classList.add('aras-tabs');
			this.setAttribute('role', 'tablist');
			this.setAttribute('aria-orientation', 'horizontal');

			this.makeSelectable();
			if (this.hasAttribute('draggable')) {
				this.makeDraggable();
			}
			this.connectKeyboard();
			this.initialized = true;
		}

		if (this.switcher) {
			this.switcher.activePaneId = null;
		}

		this.render();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'vertical') {
			const isVertical = newValue !== null;
			this.classList.toggle('aras-tabs_vertical', isVertical);
			this.setAttribute(
				'aria-orientation',
				isVertical ? 'vertical' : 'horizontal'
			);
		}

		this.render();
	}

	_getTooltipTemplate(item, itemContent, props = {}) {
		const tooltip = item.tooltip_template || item.label;
		if (!tooltip) {
			return itemContent;
		}
		const tooltipSettings = {
			'data-tooltip': tooltip,
			'data-tooltip-pos':
				item.tooltipPosition || this.tooltipSettings.tooltipPosition,
			...props
		};

		return (
			<span className="aras-tooltip" {...tooltipSettings}>
				{itemContent}
			</span>
		);
	}
}
