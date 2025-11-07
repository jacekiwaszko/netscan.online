const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let activeProcess = null;

io.on('connection', (socket) => {
  // === DETECT CLIENT IP + GEOIP ===
  const clientIp = socket.request.headers['x-forwarded-for'] || 
                   socket.request.connection.remoteAddress || 
                   socket.handshake.address;
  const cleanIp = clientIp.split(',')[0].replace('::ffff:', '').trim();

  exec(`geoiplookup ${cleanIp}`, { timeout: 10000 }, (err, stdout) => {
    let location = 'Unknown location';
    if (!err && stdout) {
      const match = stdout.match(/GeoIP Country Edition:\s*(.+)/i);
      if (match && match[1]) location = match[1].trim();
    }
    socket.emit('client-info', { ip: cleanIp, location });
  });

  const killProcess = () => {
    if (activeProcess) {
      activeProcess.kill('SIGINT'); // SIGINT stops ping instantly
      activeProcess = null;
    }
  };

  const resetUI = () => {
    socket.emit('reset-ui');
  };

  // === PING ===
  socket.on('start-ping', ({ target, count = 10 }) => {
    killProcess();
    count = Math.max(1, Math.min(1000, parseInt(count)));
    const isWin = process.platform === 'win32';
    const cmd = isWin ? `ping -n ${count} ${target}` : `ping -c ${count} -i 1 ${target}`;
    activeProcess = exec(cmd, { timeout: 60000 });

    socket.emit('output', { type: 'header', text: `PING ${target}:\n` });

    activeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim() === '') return;
        if (line.includes('time=')) {
          const match = line.match(/time[<=](\d+\.?\d*)\s*ms/);
          if (match) {
            const time = parseFloat(match[1]);
            const color = time < 30 ? 'green' : time <= 80 ? 'yellow' : 'red';
            socket.emit('line', { text: line, time, color, type: 'ping' });
          }
        } else if (line.includes('Request timeout') || line.includes('unreachable')) {
          socket.emit('line', { text: line, color: 'gray', type: 'ping' });
        } else {
          socket.emit('line', { text: line, type: 'ping' });
        }
      });
    });

    activeProcess.on('close', () => {
      socket.emit('output', { text: '\n[Ping completed]\n' });
      resetUI();
      activeProcess = null;
    });
  });

  // === WHOIS ===
  socket.on('start-whois', ({ domain }) => {
    killProcess();
    const cmd = `whois ${domain}`;
    activeProcess = exec(cmd, { timeout: 30000 });

    socket.emit('output', { type: 'header', text: `WHOIS ${domain}\n\n` });

    activeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim() === '') return;
        let color = null;
        if (/^(Registrar|Name Server|Status)/i.test(line)) color = 'cyan';
        else if (/Date/i.test(line)) color = 'yellow';
        socket.emit('line', { text: line, color, type: 'whois' });
      });
    });

    activeProcess.stderr.on('data', (data) => {
      socket.emit('line', { text: data.toString(), color: 'red', type: 'whois' });
    });

    activeProcess.on('close', () => {
      socket.emit('output', { text: '\n[End of whois data]\n' });
      resetUI();
      activeProcess = null;
    });
  });

  // === NSLOOKUP ===
  socket.on('start-nslookup', ({ domain }) => {
    killProcess();
    const cmd = `nslookup ${domain}`;
    activeProcess = exec(cmd, { timeout: 30000 });

    socket.emit('output', { type: 'header', text: `NSLOOKUP ${domain}\n\n` });

    activeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim() === '') return;
        let color = null;
        if (line.includes('Name:') || line.includes('Server:')) color = 'cyan';
        else if (line.includes('Address:')) color = 'yellow';
        else if (line.includes('Non-authoritative')) color = 'gray';
        socket.emit('line', { text: line, color, type: 'nslookup' });
      });
    });

    activeProcess.stderr.on('data', (data) => {
      socket.emit('line', { text: data.toString(), color: 'red', type: 'nslookup' });
    });

    activeProcess.on('close', () => {
      socket.emit('output', { text: '\n[End of nslookup]\n' });
      resetUI();
      activeProcess = null;
    });
  });

  // === DIG ===
  socket.on('start-dig', ({ domain, server = '1.1.1.1' }) => {
    killProcess();
    const cmd = `dig @${server} ${domain}`;
    activeProcess = exec(cmd, { timeout: 30000 });

    socket.emit('output', { type: 'header', text: `DIG @${server} ${domain}\n\n` });

    activeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim() === '') return;
        let color = null;
        if (line.includes('ANSWER SECTION')) color = 'cyan';
        else if (line.includes('A ') || line.includes('AAAA ') || line.includes('CNAME ')) color = 'yellow';
        else if (line.includes(';;')) color = 'gray';
        socket.emit('line', { text: line, color, type: 'dig' });
      });
    });

    activeProcess.stderr.on('data', (data) => {
      socket.emit('line', { text: data.toString(), color: 'red', type: 'dig' });
    });

    activeProcess.on('close', () => {
      socket.emit('output', { text: '\n[End of dig]\n' });
      resetUI();
      activeProcess = null;
    });
  });

  // === PORT SCAN ===
  socket.on('start-portscan', ({ host, port }) => {
    killProcess();
    const cmd = `nc -vz -w 5 ${host} ${port}`;
    activeProcess = exec(cmd, { timeout: 15000 });

    socket.emit('output', { type: 'header', text: `PORT SCAN: ${host}:${port}\n\n` });

    const handleOutput = (data) => {
      const line = data.toString().trim();
      if (!line) return;
      let color = 'gray';
      if (line.includes('succeeded') || line.includes('open')) color = 'green';
      else if (line.includes('failed') || line.includes('closed') || line.includes('refused')) color = 'red';
      else if (line.includes('timeout') || line.includes('DNS')) color = 'gray';
      socket.emit('line', { text: line, color, type: 'portscan' });
    };

    activeProcess.stdout.on('data', handleOutput);
    activeProcess.stderr.on('data', handleOutput);

    activeProcess.on('close', () => {
      socket.emit('output', { text: '\n[Scan completed]\n' });
      resetUI();
      activeProcess = null;
    });
  });

  // === HOST ===
  socket.on('start-host', ({ target }) => {
    killProcess();
    const cmd = `host ${target}`;
    activeProcess = exec(cmd, { timeout: 30000 });

    socket.emit('output', { type: 'header', text: `HOST ${target}\n\n` });

    activeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim() === '') return;
        let color = null;
        if (line.includes('has address') || line.includes('domain name pointer')) color = 'yellow';
        else if (line.includes('NXDOMAIN') || line.includes('not found')) color = 'red';
        else if (line.includes(';;')) color = 'gray';
        socket.emit('line', { text: line, color, type: 'host' });
      });
    });

    activeProcess.stderr.on('data', (data) => {
      socket.emit('line', { text: data.toString(), color: 'red', type: 'host' });
    });

    activeProcess.on('close', () => {
      socket.emit('output', { text: '\n[End of host]\n' });
      resetUI();
      activeProcess = null;
    });
  });

  // === IPCALC (SIMPLE ONLY) ===
  socket.on('start-ipcalc', ({ address }) => {
    killProcess();
    const cmd = `ipcalc ${address}`;
    activeProcess = exec(cmd, { timeout: 10000 });

    socket.emit('output', { type: 'header', text: `IPCALC ${address}\n\n` });

    activeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim() === '') return;
        let color = null;
        if (line.includes('Address:') || line.includes('Netmask:') || line.includes('Network:')) color = 'cyan';
        else if (line.includes('HostMin:') || line.includes('HostMax:') || line.includes('Broadcast:')) color = 'yellow';
        else if (line.includes('Hosts/Net:')) color = 'green';
        else if (line.includes('ERROR')) color = 'red';
        socket.emit('line', { text: line, color, type: 'ipcalc' });
      });
    });

    activeProcess.stderr.on('data', (data) => {
      socket.emit('line', { text: data.toString(), color: 'red', type: 'ipcalc' });
    });

    activeProcess.on('close', () => {
      socket.emit('output', { text: '\n[IPCalc completed]\n' });
      resetUI();
      activeProcess = null;
    });
  });

  // === STOP (FIXED: INSTANT KILL) ===
  socket.on('stop', () => {
    if (activeProcess) {
      activeProcess.kill('SIGINT'); // Stops ping immediately
      socket.emit('output', { text: '^C\nOperation stopped by user.\n' });
      resetUI();
      activeProcess.stdout.removeAllListeners('data');
      activeProcess.stderr.removeAllListeners('data');
      activeProcess = null;
    }
  });

  socket.on('disconnect', () => {
    killProcess();
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Network Toolbox -> http://localhost:${PORT}`);
});
