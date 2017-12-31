const request = require('superagent');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');
const { promisify } = require('util');
const wrap = require('./wrap');

class SeasonVar {
  searchFor(query) {
    return wrap(request.get('http://seasonvar.ru/autocomplete.php'), 'json')
      .query({ query: query })
      .then(res => JSON.parse(res.body))
      .then(res => {
        let titles = res.suggestions.valu;
        let urls = res.data;
        let ids = res.id;

        return this.parseTitles(titles)
          .map(t => {
            t.id = ids[t.index];
            t.url = urls[t.index];
            return t;
          });
      })
      .then(res => new SearchResult(...(res.map(s => new Season(s)))));
  }

  parseTitles(titles) {
    if (!titles) {
      return [];
    }
    
    let re = /^(.+?)\s?\/\s?(.+?)(\s?\(([0-9]+)\sсезон\))?$/;
    let m;

    return titles.map((t, i) => {
      if (!(m = t.match(re))) {
        console.error('Couldn\'t parse %s', t);
        return;
      }

      return {
        rus: m[1],
        eng: m[2],
        season: m[4] ? parseInt(m[4]) : null,
        index: i
      };
    }).filter(t => !!t);
  }
}

class SearchResult extends Array {
  filterByTitleExact(title) {
    return new SearchResult(...(this.filter(s => s.eng.toLowerCase() == title)));
  }

  findSeason(season) {
    return this.find(s => s.season == season);
  }
}

class Season {
  constructor(s) {
    this.id = s.id;
    this.rus = s.rus;
    this.eng = s.eng;
    this.index = s.index;
    this.season = s.season;
    this.url = 'http://seasonvar.ru/' + s.url;
  }

  // required to get serial id, secure mark and time params
  fetch() {
    return wrap(request(this.url))
      .then(res => {
        // suppress js errors
        const virtualConsole = new jsdom.VirtualConsole();
        let { window } = new JSDOM('<script>window.onerror=function(){}</script>' + res.body, { virtualConsole, runScripts: 'dangerously' });

        let d4p = window.data4play;
        this.time = d4p.time;
        this.secure = d4p.secureMark;

        let attr = window.document
          .querySelector('[data-id-serial]')
          .getAttribute('data-id-serial');

        this.serial = attr;

        window.close();

        return this;
      });
  }

  getTranslations() {
    return wrap(request.post('http://seasonvar.ru/player.php'), 'blob')
      .type('form')
      .send({
        id: this.id.toString(),
        serial: this.serial,
        type: 'html5',
        secure: this.secure,
        time: this.time
      })
      .then(res => this.analyze(res.body))
      .then(translations => new Translations(...(translations.map(t => new Translation(t, this)))));
  }

  analyze(html) {
    // this stupid charset trick is required in order to tell jsdom to treat the page utf8
    // and return correct russian strings
    let dom = new JSDOM(Buffer.from('<meta charset="UTF-8">' + html, 'utf8'));

    let scripts = dom.window.document.querySelectorAll('script');
    scripts = Object.keys(scripts).map(k => scripts[k]);
    // drop player script tags
    scripts = scripts.slice(3, scripts.length - 1);

    let translations = stupidJSEval(scripts);

    let labels = dom.window.document.querySelectorAll('ul.pgs-trans li');
    labels = Object.keys(labels).map(l => ({ id: parseInt(labels[l].getAttribute('data-translate')), label: labels[l].textContent }));
    labels.splice(-2);
    translations = labels.map(l => { l.url = translations[l.id]; return l });

    dom.window.close();

    return translations;
  }
}

class Translations extends Array {
  findByLabel(label) {
    return this.find(t => t.label == label);
  }

  findByLabels(labels) {
    return this.find(t => labels.map(l => l.toLowerCase()).indexOf(t.label.toLowerCase()) > -1);
  }
}

class Translation {
  constructor(t, season) {
    this.id = t.id;
    this.label = t.label;
    this.url = 'http://seasonvar.ru' + t.url;
    this.season = season;
  }

  getPlaylist() {
    return wrap(request.get(this.url), 'json')
      .then(res => JSON.parse(res.body))
      .then(pl => new Playlist(...(pl.map(e => new Episode(e, this, this.season)))));
  }
}

class Playlist extends Array {
  findEpisode(index) {
    return this.find(e => e.index == index);
  }
}

class Episode {
  constructor(e, translation, season) {
    this.index = parseInt(e.id);
    this.title = e.title.replace(/^(.+?)(<br>.*)?$/, '$1');
    this.url = e.file;
    this.translation = translation;
    this.season = season;
  }
}

function stupidJSEval(scripts) {
  return (function() {
    eval(scripts.map(s => s.textContent).join('\n'));
    return pl;
  })();
}

module.exports = { SeasonVar };
