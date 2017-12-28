function wrap(request, rtype = 'blob') {
  return request
    .responseType(rtype)
    .set('Origin', 'http://seasonvar.ru')
    .set('Referer', 'http://seasonvar.ru/') // serial-16778-Karatel__2017.html
    .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.108 Safari/537.36')
    .set('X-Requested-With', 'XMLHttpRequest')
}

module.exports = wrap;
