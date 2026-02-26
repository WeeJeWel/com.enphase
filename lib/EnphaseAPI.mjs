import { URL } from 'url';
import fetch from 'node-fetch';

export default class EnphaseAPI {

  cookies = [];
  headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  };
  siteId = null;

  constructor({
    username = null,
    password = null,
  } = {}) {
    this.username = username;
    this.password = password;
  }

  isLoggedIn() {
    return this.cookies.length > 0;
  }

  async login({
    username = this.username,
    password = this.password,
  } = []) {
    if (!username) {
      throw new Error('Missing Username');
    }

    if (!password) {
      throw new Error('Missing Password');
    }

    const res = await fetch('https://enlighten.enphaseenergy.com/login/login', {
      method: 'POST',
      headers: { ...this.headers },
      body: new URLSearchParams({
        'user[email]': username,
        'user[password]': password,
      }),
      redirect: 'manual',
    });

    if (res.status !== 302) {
      throw new Error('Invalid e-mail and/or password.');
    }

    this.cookies = res.headers.raw()['set-cookie'].map(cookie => cookie.split(';')[0]);
  }

  async loginJSON({
    username = this.username,
    password = this.password,
  } = []) {
    if (!username) {
      throw new Error('Missing Username');
    }

    if (!password) {
      throw new Error('Missing Password');
    }

    const res = await fetch('https://enlighten.enphaseenergy.com/login/login.json', {
      method: 'POST',
      headers: {
        ...this.headers,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'user[email]': username,
        'user[password]': password,
      }),
    });

    if (!res.ok) {
      throw new Error(res.statusText);
    }

    return await res.json();
  }

  async getSiteIds() {
    if (!this.isLoggedIn()) {
      await this.login();
    }

    const res = await fetch('https://enlighten.enphaseenergy.com/systems.js', {
      method: 'GET',
      headers: {
        ...this.headers,
        Cookie: this.cookies.join('; '),
      },
      redirect: 'manual',
    });

    if (res.status === 401) {
      this.cookies = [];
      throw new Error('Unauthorized');
    }

    const location = res.headers.get('Location');
    const contentType = res.headers.get('Content-Type');

    // If there's only one system, we need to get the siteId from the Location header
    if (location) {
      const locationUrl = new URL(location);
      const locationUrlPathname = locationUrl.pathname.split('/');
      const siteId = Number(locationUrlPathname[locationUrlPathname.length - 1]);
      if (!siteId) {
        throw new Error('Missing Site ID');
      }

      if (typeof siteId !== 'number' || Number.isNaN(siteId)) {
        throw new Error('Invalid Site ID');
      }

      return [siteId];
    }

    // If there are multiple systems, we need to get the siteIds from the JSON response
    if (contentType?.includes('text/javascript')) {
      const json = await res.json();

      if (!Array.isArray(json.map_data)) {
        throw new Error('Invalid Map Data');
      }

      return json.map_data.map(system => system.id);
    }

    throw new Error('Error Getting Site IDs');
  }

  async getSiteData({
    siteId,
  } = {}) {
    if (!this.isLoggedIn()) {
      await this.login();
    }

    if (!siteId) {
      throw new Error('Missing Site ID');
    }

    const res = await fetch(`https://enlighten.enphaseenergy.com/app-api/${siteId}/data.json`, {
      headers: {
        ...this.headers,
        Cookie: this.cookies.join('; '),
      },
    });

    if (res.status === 401) {
      this.cookies = [];
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      throw new Error(res.statusText ?? 'Error Getting Site Data');
    }

    return await res.json();
  }

  async getSiteToday({
    siteId,
  } = {}) {
    if (!this.isLoggedIn()) {
      await this.login();
    }

    if (!siteId) {
      throw new Error('Missing Site ID');
    }

    const res = await fetch(`https://enlighten.enphaseenergy.com/pv/systems/${siteId}/today`, {
      headers: {
        ...this.headers,
        Cookie: this.cookies.join('; '),
      },
    });

    if (res.status === 401) {
      this.cookies = [];
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      throw new Error(res.statusText ?? 'Error Getting Site Today');
    }

    return await res.json();
  }

  async getEntrezToken({
    username = this.username,
    password = this.password,
    serialNumber = null,
  }) {
    if (!username) {
      throw new Error('Missing Username');
    }

    if (!serialNumber) {
      throw new Error('Missing Serial Number');
    }

    const {
      session_id,
    } = await this.loginJSON({
      username,
      password,
    });

    const res = await fetch('https://entrez.enphaseenergy.com/tokens', {
      method: 'POST',
      headers: {
        ...this.headers,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        session_id,
        serial_num: serialNumber,
      }),
    });

    if (!res.ok) {
      throw new Error(res.statusText);
    }

    return await res.text();
  }

  async getInverters({
    siteId,
  } = {}) {
    if (!this.isLoggedIn()) {
      await this.login();
    }

    if (!siteId) {
      throw new Error('Missing Site ID');
    }

    const res = await fetch(`https://enlighten.enphaseenergy.com/app-api/${siteId}/inverters.json?limit=100&offset=0&search=`, {
      headers: {
        ...this.headers,
        Cookie: this.cookies.join('; '),
      },
    });

    if (res.status === 401) {
      this.cookies = [];
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      throw new Error(res.statusText ?? 'Error Getting Inverters');
    }

    return await res.json();
  }

  // https://enlighten.enphaseenergy.com/systems/2164579/inverter_status_x.json
  // {
  //     "47545839": {
  //         "serialNum": "121928155494",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44771843,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47546659": {
  //         "serialNum": "121932046011",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44772568,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47546660": {
  //         "serialNum": "121928124617",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44772569,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47546661": {
  //         "serialNum": "121932040893",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44772570,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47546662": {
  //         "serialNum": "121915102794",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44772571,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47547265": {
  //         "serialNum": "121928125281",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44773073,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47547267": {
  //         "serialNum": "121932045900",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44773076,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47547269": {
  //         "serialNum": "121932041142",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44773078,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47547271": {
  //         "serialNum": "121928125280",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44773080,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47547272": {
  //         "serialNum": "121932041031",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44773081,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "47547274": {
  //         "serialNum": "121928145424",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 44773083,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "49321352": {
  //         "serialNum": "121932046023",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 46325751,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     },
  //     "49321353": {
  //         "serialNum": "121928163264",
  //         "statusCode": "normal",
  //         "status": "Normal",
  //         "deviceId": 46325752,
  //         "issi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "rssi": {
  //             "sig_str": 0,
  //             "level": 0
  //         },
  //         "emu_version": "8.3.5167",
  //         "show_sig_str": false,
  //         "type": "IQ7"
  //     }
  // }

  // https://enlighten.enphaseenergy.com/systems/2164579/inverter_data_x/energy.json?start_date=2026-02-26&end_date=2026-02-26
  //   {
  //     "production": {
  //         "47545839": 145,
  //         "47546659": 125,
  //         "47546660": 123,
  //         "47546661": 159,
  //         "47546662": 136,
  //         "47547265": 163,
  //         "47547267": 193,
  //         "47547269": 189,
  //         "47547271": 178,
  //         "47547272": 196,
  //         "47547274": 149,
  //         "49321352": 99,
  //         "49321353": 153
  //     },
  //     "start_date": "2026-02-26",
  //     "end_date": "2026-02-26"
  // }



}