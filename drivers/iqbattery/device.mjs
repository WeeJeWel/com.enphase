import EnphaseDevice from '../../lib/iqbattery/iqbattery_EnphaseDevice.mjs';

export default class EnphaseDeviceIQBattery extends EnphaseDevice {

  async onPollCloud() {
    await super.onPollCloud();

    const { siteId } = this.getData();

    const todayData = await this.api.getSiteToday({ siteId });

    // This has been commented out because the data did not correspond to the actual power generation :(
    // const measurePower = todayData?.latest_power?.value; // in W
    // if (typeof measurePower === 'number') {
    //   await this.setCapabilityValue('measure_power', measurePower)
    //     .catch(err => this.error('Error setting measure_power:', err));
    // }

    // Measurements
    const accuproduction = todayData?.stats?.[0]?.totals?.production; // in Wh
    if (typeof accuproduction === 'number') {
      await this.setCapabilityValue('iqbattery_solar_production', accuproduction / 1000)
        .catch(err => this.error('Error setting iqbattery_solar_production:', err));
    }

    const accuconsumption = todayData?.stats?.[0]?.totals?.consumption; // in Wh
    if (typeof accuconsumption === 'number') {
      await this.setCapabilityValue('iqbattery_home', accuconsumption / 1000)
        .catch(err => this.error('Error setting iqbattery_home:', err));
    }

    const accuimport = todayData?.stats?.[0]?.totals?.import; // in Wh
    if (typeof accuimport === 'number') {
      await this.setCapabilityValue('iqbattery_grid_import', accuimport / 1000)
        .catch(err => this.error('Error setting iqbattery_grid_import:', err));
    }

    const accuexport = todayData?.stats?.[0]?.totals?.export; // in Wh
    if (typeof accuexport === 'number') {
      await this.setCapabilityValue('iqbattery_export', accuexport / 1000)
        .catch(err => this.error('Error setting iqbattery_export:', err));
    }

    const accucharge = todayData?.stats?.[0]?.totals?.charge; // in Wh
    if (typeof accucharge === 'number') {
      await this.setCapabilityValue('iqbattery_charge', accucharge / 1000)
        .catch(err => this.error('Error setting iqbattery_charge:', err));
    }

    const accudischarge = todayData?.stats?.[0]?.totals?.discharge; // in Wh
    if (typeof accudischarge === 'number') {
      await this.setCapabilityValue('iqbattery_discharge', accudischarge / 1000)
        .catch(err => this.error('Error setting iqbattery_discharge:', err));
    }

    // Connection Type
    const connectionEntry = todayData?.connectionDetails?.[0];
    let connectionType = 'Onbekend';
    if (connectionEntry) {
      if (connectionEntry.ethernet === true) {
        connectionType = 'LAN';
      } else if (connectionEntry.wifi !== null && connectionEntry.wifi !== undefined) {
        // Als wifi niet null is (bijv. true of een signaalsterkte string), dan is het WiFi
        connectionType = 'WiFi';
      } else if (connectionEntry.cellular === true) {
        connectionType = 'Mobiel';
      } else {
        connectionType = 'Offline';
      }
    }
    await this.setCapabilityValue('iqbattery_connectiontype', connectionType)
      .catch(err => this.error('Error setting iqbattery_connectiontype:', err));

    // Battery Level
    const accuaggregatesoc = todayData?.battery_details?.aggregate_soc;
    if (typeof accuaggregatesoc === 'number') {
      await this.setCapabilityValue('measure_battery', accuaggregatesoc)
        .catch(err => this.error('Error setting measure_battery:', err));
      await this.setCapabilityValue('iqbattery_level', accuaggregatesoc)
        .catch(err => this.error('Error setting iqbattery_level:', err));
      this.homey.log(`Battery Level: ${accuaggregatesoc}%`);
    }

    // Last Update
    const lastseen = todayData?.last_report_date;
    const dateObject = new Date(lastseen * 1000);
    const dateString = dateObject.toLocaleString('nl-NL', {
      timeZone: 'Europe/Amsterdam', // Forceert de juiste tijdzone incl. wintertijd
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false // Forceert 24-uurs notatie
    }).replace(',', ''); // Verwijdert de komma die JS soms tussen datum en tijd zet

    if (typeof dateString === 'string' || typeof lastseen === 'number') {
      // Werk de iqbattery_last_update capability bij met de geformatteerde laatste-update 
      await this.setCapabilityValue('iqbattery_last_update', dateString)
        .catch(err => this.error('Error iqbattery_last_update:', err));
    }
  }

};
