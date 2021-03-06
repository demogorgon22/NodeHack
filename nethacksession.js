const { EventEmitter } = require('events');
const Client = require('./client');
const { NethackWindow, windowIds } = require('./nhwindow');

module.exports = class NethackSession extends EventEmitter {
  constructor() {
    super();
    this.client = new Client();
    this.windows = [];
    this.connected = false;
    this.messages = [];
    this.dungeonMap = null;
    this.currentText = '';
  }

  async loginSSH(dglUsername, dglPassword, sshAddress) {
    const { client } = this;
    try {
      client.start();
    } catch (e) {
      throw new Error('Could not initialize session');
    }

    try {
      // connect  to server
      await client.doANSIInput(`ssh ${sshAddress}\n`);
    } catch (e) {
      throw new Error(`Could not connect to ${sshAddress}`);
    }

    try {
      // choose option l)ogin
      // enter DGL usename
      // enter DGL password
      // "vanilla" in HDF-Menu
      await client.doANSIInput('l');
      await client.doANSIInput(`${dglUsername}\n`);
      await client.doANSIInput(`${dglPassword}\n`);
      await client.doANSIInput('v');
      this.windows = await client.doNHInput(' ');
      this.connected = true;
      this.update();
    } catch (e) {
      throw new Error(`Could not login: ${e.message}`);
    }
    this.emit('connected');
  }

  getRawWindow(name) {
    const window = this.windows.find(win => win.name === name);
    if (typeof window === 'undefined') {
      throw new Error(`Could not find window with name ${name}`);
    }
    return window;
  }

  getWindow(name) {
    const coreWindow = NethackWindow.getCoreWindowByName(name);
    const rawBaseWindow = this.getRawWindow(name);
    const { baseDimensions } = this.client;
    const resizedDimensions = coreWindow.resize(baseDimensions);
    const normalizedDataWindow = rawBaseWindow.normalizedDataWindow();
    return new NethackWindow(resizedDimensions, rawBaseWindow.id, normalizedDataWindow);
  }

  getANSIWindow() {
    // ANSI data doesn't need to get normalized
    return this.getRawWindow('none');
  }

  getBaseWindow() {
    return this.getWindow('base');
  }

  getMessageWindow() {
    return this.getWindow('message');
  }

  getStatusWindow() {
    return this.getWindow('status');
  }

  getMapWindow() {
    return this.getWindow('map');
  }

  getTextWindow() {
    return this.getWindow('text');
  }

  getMenuWindow() {
    return this.getWindow('menu');
  }

  updateMessages() {
    const window = this.getMessageWindow();
    this.messages = [...this.messages, window.toString('')];
    this.emit('updatedMessages', this.messages.slice(-1));
  }

  updateText() {
    // do nothing for now
    this.emit('updatedText');
  }

  updateMap() {
    // normalized
    const window = this.getWindow('map');

    if (this.dungeonMap === null) {
      this.dungeonMap = window; // initialize
    } else {
      const updateData = window.applyUpdate(this.dungeonMap);
      this.dungeonMap = new NethackWindow({
        rows: 24, cols: 80, rowno: 21, colno: 80,
      }, windowIds.NHW_MAP, updateData);
    }
    this.emit('updatedMap', this.dungeonMap);
  }

  async doInput(str) {
    const windows = await this.client.doNHInput(str);
    this.windows = windows;
    this.update();
    this.emit('updatedAll');
  }

  update() {
    this.updateMessages();
    this.updateMap();
  }

  close() {
    this.client.disconnect();
  }
};
