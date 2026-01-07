const fs = require("fs");
const path = require("path");

let appJson;
if(fs.existsSync(dirname + "/.homeycompose/app.json")) {
	appJson = require(dirname + "/.homeycompose/app.json");
} else {
	appJson = require(dirname + "/app.json");
}

const scripts = {
	"test": "homey app run",
	"start": "npm install && homey app install",
	"build": "homey app build",
	"publish": "homey app publish",
	"postpublish": "npm run init && git commit --amend --no-edit ./package.json && git push -f origin main",
	"validate": "homey app validate -l publish",
	"validateTest": "homey app validate",
	"init": "npm init --quiet -y 1>/dev/null",
	"lint": "eslint .",
	"createRemoteRepo": "hub create -d \"$npm_package_description\" -h $npm_package_homepage ${PWD##*/} && git commit --amend --no-edit && git push -u origin main"
}

// set "homey" package.json
module.exports = {
	name: package.name !== appJson.id ? package.name : path.basename(process.cwd()).toLowerCase(),
	version: appJson.version || "0.0.0",
	description: appJson.description ? appJson.description.en || appJson.description : package.description || "",
	main: package.main || "app.js",
	engines: package.engines || { node: ">=12.16.1" }, 	//** Used for eslint-config-athom **
	keywords: [...new Set([].concat(package.keywords || [], ["Smarthome", "athom", "homey", "app", appJson.name.en || appJson.name, appJson.id]))],
	author: appJson.author ? `${appJson.author.name} <${appJson.author.email}>`: package.author || "John Doe <john@doe.com>",
	license: package.license || "GPL-3.0", 					//** License-id not exist (use default) **
	bugs: appJson.bugs || package.bugs || {url: "https://github.com/"},
	homepage: appJson.id ? "https://homey.app/a/" + appJson.id : package.homepage || "https://github.com/",
	scripts: Object.assign({}, package.scripts || {}, scripts),
}