// Parser per file DVW
// Estrae statistiche di battuta, ricezione, attacco, muro

class DVWParser {
  constructor(fileContent) {
    this.content = fileContent;
    this.match = {};
    this.teams = {};
    this.players = {};
    this.stats = {};
  }

  parse() {
    this.parseMatch();
    this.parseTeams();
    this.parsePlayers();
    this.parseScout();
    return this.calculateStats();
  }

  parseMatch() {
    const matchSection = this.getSection('[3MATCH]');
    const lines = matchSection.split('\n');
    const data = lines[0].split(';');
    this.match = {
      date: data[0],
      time: data[1],
      season: data[2],
      tournament: data[3]
    };
  }

  parseTeams() {
    const teamsSection = this.getSection('[3TEAMS]');
    const lines = teamsSection.trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        const parts = line.split(';');
        const code = parts[0];
        const name = parts[1];
        this.teams[code] = { name, code };
      }
    });
  }

  parsePlayers() {
    // Home players
    const homeSection = this.getSection('[3PLAYERS-H]');
    this.parsePlayerSection(homeSection, 'H');
    
    // Visiting players
    const visitingSection = this.getSection('[3PLAYERS-V]');
    this.parsePlayerSection(visitingSection, 'V');
  }

  parsePlayerSection(section, team) {
    const lines = section.trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        const parts = line.split(';');
        const teamCode = team === 'H' ? Object.keys(this.teams)[0] : Object.keys(this.teams)[1];
        const playerId = parts[2]; // numero di maglia
        const surname = parts[4];
        const name = parts[5];
        
        const key = `${teamCode}_${playerId}`;
        this.players[key] = {
          id: playerId,
          name: name || '',
          surname: surname || '',
          team: teamCode,
          teamName: this.teams[teamCode]?.name || ''
        };
      }
    });
  }

  parseScout() {
    const scoutSection = this.getSection('[3SCOUT]');
    const lines = scoutSection.trim().split('\n');
    
    lines.forEach(line => {
      if (line.trim()) {
        this.parseAction(line);
      }
    });
  }

  parseAction(line) {
    // Formato: *PPAACCEEEE~ZZ~HHMM...
    // P = player number (2 cifre)
    // A = action type
    // C = action code
    // E = evaluation
    
    const match = line.match(/^[*a](\d{1,2})([A-Z])([A-Z])([\+\-#=!\/])?/);
    if (!match) return;

    const playerNum = match[1];
    const actionType = match[2]; // S=Servizio, R=Ricezione, A=Attacco, M=Muro, etc
    const actionCode = match[3];
    const evaluation = match[4] || '';

    // Determina team dal contesto (simplified - assume alternanza)
    const teamCode = Object.keys(this.teams)[0];
    const key = `${teamCode}_${playerNum}`;

    if (!this.stats[key]) {
      this.stats[key] = {
        ...this.players[key] || { id: playerNum, team: teamCode },
        battuta: { totali: 0, punti: 0, errori: 0, ace: 0 },
        ricezione: { totali: 0, positive: 0, errori: 0, perfette: 0 },
        attacco: { totali: 0, punti: 0, errori: 0, muri: 0 },
        muro: { totali: 0, punti: 0, errori: 0, tocchi: 0 }
      };
    }

    // Battuta (S)
    if (actionType === 'S') {
      this.stats[key].battuta.totali++;
      if (evaluation === '+' || evaluation === '#') this.stats[key].battuta.ace++;
      if (evaluation === '-') this.stats[key].battuta.errori++;
      if (evaluation === '#' || evaluation === '=') this.stats[key].battuta.punti++;
    }

    // Ricezione (R)
    if (actionType === 'R') {
      this.stats[key].ricezione.totali++;
      if (evaluation === '+') {
        this.stats[key].ricezione.positive++;
        this.stats[key].ricezione.perfette++;
      }
      if (evaluation === '-') this.stats[key].ricezione.errori++;
    }

    // Attacco (A)
    if (actionType === 'A') {
      this.stats[key].attacco.totali++;
      if (evaluation === '#' || evaluation === '=') this.stats[key].attacco.punti++;
      if (evaluation === '-') this.stats[key].attacco.errori++;
      if (evaluation === '/') this.stats[key].attacco.muri++;
    }

    // Muro (M)
    if (actionType === 'M') {
      this.stats[key].muro.totali++;
      if (evaluation === '#' || evaluation === '=') this.stats[key].muro.punti++;
      if (evaluation === '-') this.stats[key].muro.errori++;
      this.stats[key].muro.tocchi++;
    }
  }

  calculateStats() {
    const result = {
      match: this.match,
      teams: this.teams,
      players: this.players,
      statistics: {}
    };

    Object.keys(this.stats).forEach(key => {
      const player = this.stats[key];
      result.statistics[key] = {
        ...player,
        battuta: {
          ...player.battuta,
          percentuale: player.battuta.totali > 0 
            ? ((player.battuta.punti / player.battuta.totali) * 100).toFixed(1) 
            : 0,
          acePercentuale: player.battuta.totali > 0
            ? ((player.battuta.ace / player.battuta.totali) * 100).toFixed(1)
            : 0
        },
        ricezione: {
          ...player.ricezione,
          percentuale: player.ricezione.totali > 0
            ? ((player.ricezione.positive / player.ricezione.totali) * 100).toFixed(1)
            : 0
        },
        attacco: {
          ...player.attacco,
          percentuale: player.attacco.totali > 0
            ? ((player.attacco.punti / player.attacco.totali) * 100).toFixed(1)
            : 0
        },
        muro: {
          ...player.muro,
          percentuale: player.muro.totali > 0
            ? ((player.muro.punti / player.muro.totali) * 100).toFixed(1)
            : 0
        }
      };
    });

    return result;
  }

  getSection(sectionName) {
    const regex = new RegExp(`${sectionName}([\\s\\S]*?)(?=\\[3|$)`);
    const match = this.content.match(regex);
    return match ? match[1] : '';
  }
}

module.exports = DVWParser;
