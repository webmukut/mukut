$(document).ready(function(){
  $('.porfolio-img').slick({
    speed: 500,
    autoplay: true,
    arrows: false,
    slidesToShow: 2,
    slidesToScroll: 1,
    // arrows: true,
    dots: true,
  });

    $(".porfolio-img-text img").click(function () {
        $(".porfolio-img-text img").removeClass("porfolio-active");
        // $(".tab").addClass("active"); // instead of this do the below 
        $(this).addClass("porfolio-active");   
    });
    $('.review-slick').slick({
      speed: 500,
      autoplay: true,
      arrows: false,
      slidesToShow: 2,
      slidesToScroll: 1,
      // arrows: true,
      dots: true,
    });
});
	




var btn = $('#button');

$(window).scroll(function() {
  if ($(window).scrollTop() > 300) {
    btn.addClass('show');
  } else {
    btn.removeClass('show');
  }
});




window.onscroll = function() {myFunction()};

var navbar = document.getElementById("menu");
var sticky = navbar.offsetTop;

function myFunction() {
  if (window.pageYOffset >= sticky) {
    navbar.classList.add("sticky")
  } else {
    navbar.classList.remove("sticky");
  }
}
