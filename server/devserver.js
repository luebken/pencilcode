var express = require('express'),
    parseUrl = require('parseurl'),
    path = require('path'),
    http = require('http'),
    https = require('https'),
    url = require('url'),
    tamper = require('tamper'),
    serverbase = require('./serverbase.js'),
    config = require('./config'),
    httpProxy = require('http-proxy'),
    app = module.exports = express(),
    os=require('os'),

    proxy = new httpProxy.createProxyServer({});

proxy.on('error', function() {
});

function rewriteRules(req, res, next) {
  var u = parseUrl(req);
  if (u.pathname == '/') { u.pathname = '/welcome.html'; }
  else if (/^\/edit\//.test(u.pathname)) {
    if (/^frame\./.test(req.headers['host'])) {
      u.pathname = '/framed.html';
    } else {
      u.pathname = '/editor.html';
    }
  }
  else if (/^\/home(?=\/).*\/$/.test(u.pathname)) { u.pathname = '/dir.html'; }
  else { next(); return; }
  req.url = url.format(u);
  next();
}

var expandSiteInclude = tamper(function(req, res) {
  if (!/^(?:(?:https?:)?\/\/[^\/]+)?\/[^\/]*\.html$/i.test(req.url)) {
    return;
  }
  return function(body) {
    if (res.locals.site) {
      body = body.replace(/<!--#echo var="site"-->/g,
          res.locals.site + res.locals.portpart);
    }
    if (res.locals.filepath) {
      body = body.replace(/<!--#echo var="filepath"-->/g, res.locals.filepath);
    }
    return body;
  }
});

function noAppcache(req, res, next) {
  var u = parseUrl(req);
  if (/\.appcache$/.test(u.pathname)) {
    res.status(404).send()
  } else {
    next();
  }
}

function proxyRules(req, res, next) {
  var u = parseUrl(req);
  var exp = (req.app.locals.config.useProxy) ?
    /^\/(?:code|home|load|save|proxy|img|link|print|socket\.io)(?=\/)/
       : /^\/(?:proxy)(?=\/)/;
  if (exp.test(u.pathname) &&
      /\.dev$/.test(u.host)) {
    var host = req.headers['host'] = u.host.replace(/\.dev$/, '');
    req.headers['url'] = u.path;
    proxy.web(req, res, {
      target: { host: host, port: 80 },
      xfwd: true
    });
  } else {
    next();
  }
}

function proxyPacGenerator(req, res, next) {
  var u = parseUrl(req);
  if (u.pathname == '/proxy.pac') {
    var hostHeader = req.get('host'),
        hostMatch = /^([^:]+)(?::(\d*))?$/.exec(hostHeader || ''),
        hostDomain = (hostMatch && hostMatch[1]) || 'localhost',
        hostPort = (hostMatch && hostMatch[2]) || process.env.PORT;
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end(
        'function FindProxyForURL(url, host) {\n' +
        ' if (shExpMatch(host, "*.dev") || ' +
              'host == "drive.pencilcode.net") {\n' +
        '  return "PROXY ' + hostDomain + ':' + hostPort + '";\n' +
        ' }\n' +
        ' return "DIRECT";\n' +
        '}\n'
    );
  } else {
    next();
  }
}


serverbase.initialize(app);
app.use(rewriteRules);
app.use(expandSiteInclude);
app.use(noAppcache);
app.use(proxyRules);
app.use(proxyPacGenerator);
serverbase.initialize2(app);

var server = false;
if (app.locals.config.useHttps) {
  var fs = require('fs')
  var options = {
    key: fs.readFileSync('server/devserver-key.pem'),
    cert: fs.readFileSync('server/devserver-cert.pem')
  };
  server = https.createServer(options, app);
} else {
  server = http.createServer(app);
}


console.log("os.networkInterfaces() " , os.networkInterfaces())

server.listen(process.env.PORT, "0.0.0.0", function() {
  console.log('YYYExpress server listening on ' + process.env.PORT);
});
