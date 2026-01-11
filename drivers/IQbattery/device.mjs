import https from 'https';
import fetch from 'node-fetch';
import EnphaseDevice from '../../lib/EnphaseDevice.mjs';

export default class EnphaseDeviceInverter extends EnphaseDevice {

  localAgent = new https.Agent({
    rejectUnauthorized: false,
  });
  localSerialNumber = null;
  localAddress = null;
  localToken = null;

  async onInit() {
    await super.onInit();

    const { siteId } = this.getData();
    this.log(`Site ID: ${siteId}`);

    if (this.homey.platform === 'local') {
      this.discoveryStrategy = this.homey.discovery.getStrategy('enphase-envoy');
      this.discoveryStrategy.on('result', discoveryResult => {
        this.onDiscoveryResult(discoveryResult);
      });

      const discoveryResults = this.discoveryStrategy.getDiscoveryResults()
      for (const discoveryResult of Object.values(discoveryResults)) {
        this.onDiscoveryResult(discoveryResult);
      }
    }
  }

  async onPollCloud() {
    await super.onPollCloud();

    const { siteId } = this.getData();

    const siteData = await this.api.getSiteData({ siteId });
    const todayData = await this.api.getSiteToday({ siteId });

    // This has been commented out because the data did not correspond to the actual power generation :(
    // const measurePower = todayData?.latest_power?.value; // in W
    // if (typeof measurePower === 'number') {
    //   await this.setCapabilityValue('measure_power', measurePower)
    //     .catch(err => this.error('Error setting measure_power:', err));
    // }



    //****** */ */
    //update IQbat capabilities
    const accuproduction = todayData?.stats?.[0]?.totals?.production; // in Wh
    if (typeof accuproduction === 'number') {
      await this.setCapabilityValue('IQbat_solar_production', accuproduction / 1000)
        .catch(err => this.error('Error setting IQbat_solar_production:', err));
    }
    const accuconsumption = todayData?.stats?.[0]?.totals?.consumption; // in Wh
    if (typeof accuconsumption === 'number') {
      await this.setCapabilityValue('IQbat_home', accuconsumption / 1000)
        .catch(err => this.error('Error setting IQbat_home:', err));
    }
    const accuimport = todayData?.stats?.[0]?.totals?.import; // in Wh
    if (typeof accuimport === 'number') {
      await this.setCapabilityValue('IQbat_grid_import', accuimport / 1000)
        .catch(err => this.error('Error setting IQbat_grid_import:', err));
    }
    const accuexport = todayData?.stats?.[0]?.totals?.export; // in Wh
    if (typeof accuexport === 'number') {
      await this.setCapabilityValue('IQbat_export', accuexport / 1000)
        .catch(err => this.error('Error setting IQbat_export:', err));
    }
    const accucharge = todayData?.stats?.[0]?.totals?.charge; // in Wh
    if (typeof accucharge === 'number') {
      await this.setCapabilityValue('IQbat_charge', accucharge / 1000)
        .catch(err => this.error('Error setting IQbat_charge:', err));
    }
    const accudischarge = todayData?.stats?.[0]?.totals?.discharge; // in Wh
    if (typeof accudischarge === 'number') {
      await this.setCapabilityValue('IQbat_discharge', accudischarge / 1000)
        .catch(err => this.error('Error setting IQbat_discharge:', err));
    }


    //connection type
    const connectionEntry = todayData?.connectionDetails?.[0];
    let verbindingTekst = "Onbekend";
    if (connectionEntry) {
//      this.homey.log(`Status check: WiFi=${connectionEntry.wifi}, Ethernet=${connectionEntry.ethernet}`);
      if (connectionEntry.ethernet === true) {
        verbindingTekst = "LAN";
      } else if (connectionEntry.wifi !== null && connectionEntry.wifi !== undefined) {
        // Als wifi niet null is (bijv. true of een signaalsterkte string), dan is het WiFi
        verbindingTekst = "WiFi";
      } else if (connectionEntry.cellular === true) {
        verbindingTekst = "Mobiel";
      } else {
        verbindingTekst = "Offline";
      }
    }
    await this.setCapabilityValue('IQbat_connectiontype', verbindingTekst)
      .catch(err => this.error('Error setting IQbat_connectiontype:', err));
    //    this.homey.log(`Uiteindelijk Verbindingstype: ${verbindingTekst}`);


    //battery level %
    const accuaggregatesoc = todayData?.battery_details?.aggregate_soc;
    if (typeof accuaggregatesoc === 'number') {
      await this.setCapabilityValue('measure_battery', accuaggregatesoc)
        .catch(err => this.error('Error setting measure_battery:', err));
      await this.setCapabilityValue('IQbat_level', accuaggregatesoc)
        .catch(err => this.error('Error setting IQbat_level:', err));
      this.homey.log(`Battery Level: ${accuaggregatesoc}%`);
    }

    //IQbat_last_update
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
    this.log(`Laatste update gezet op: ${dateString}`);
    if (typeof dateString === 'string' || typeof lastseen === 'number') {
      // ... je dateString berekening ...
      await this.setCapabilityValue('IQbat_last_update', dateString)
        .catch(err => this.error('Error IQbat_last_update:', err));
      this.homey.log(`LastCheck: ${dateString}`);
    }
    this.homey.log(this.homey.platform)

    //****** */ */

  }


  onDiscoveryResult(discoveryResult) {
    this.log(`Local Envoy Found: ${discoveryResult.address} — S/N: ${discoveryResult.txt.serialnum}`);

    this.localToken = null;
    this.localAddress = discoveryResult.address;
    this.localSerialNumber = discoveryResult.txt.serialnum;

    discoveryResult.once('addressChanged', () => {
      this.log(`Local Envoy Address Changed: ${this.localAddress} → ${discoveryResult.address}`);
      this.localAddress = discoveryResult.address;
    });

    this.pollLocal();
  }

};