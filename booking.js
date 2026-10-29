// Модуль бронирования Bnovo. uid — код объекта «Дивеевский паломник» в Bnovo.
(function () {
  var BnovoBookFrame = new BookingIframe({
    html_id: 'booking_iframe',
    uid: '8c55eea3-127d-4d8d-adc8-c77f45ecd078',
    lang: 'ru',
    width: 'auto',
    height: 'auto',
    rooms: '',
    IsMobile: '0',
    scroll_to_rooms: '1',
    fixed_header_selector: '.site-header',
    fixed_mobile_header_selector: '.site-header'
  });
  BnovoBookFrame.init();
})();
