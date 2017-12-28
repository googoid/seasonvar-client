const { SeasonVar } = require('./lib/client.js')

let serialTitle = 'the walking dead';
let lookForSeason = 7;
let lookForTranslation = 'LostFilm';
let lookForEpisode = 9;

let seasonvar = new SeasonVar();

seasonvar
  .searchFor(serialTitle)
  .then(res => res.filterByTitleExact(serialTitle).findSeason(lookForSeason).fetch())
  .then(season => season.getTranslations())
  .then(translations => translations.findByLabel(lookForTranslation))
  .then(translation => translation.getPlaylist())
  .then(episodes => episodes.findEpisode(lookForEpisode))
  .then(console.log);
