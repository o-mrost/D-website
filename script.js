
var searchBox, map, gmarkers, pos, infowindow, markersIds;

function initMap() {

    pos = {
        lat: 52.5200,
        lng: 13.4050
    };
    gmarkers = [];
    markersIds = [];

    map = new google.maps.Map(document.getElementById('map'), {
        center: pos,
        zoom: 14,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_RIGHT
        }
    });

    // Create the search box and link it to the UI element.
    var input = document.getElementById('pac-input');
    searchBox = new google.maps.places.SearchBox(input);
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

    // Bias the SearchBox results towards current map's viewport.
    map.addListener('bounds_changed', function () {
        searchBox.setBounds(map.getBounds());
    });

    showSearchResults();

    // Try HTML5 geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            map.setCenter(pos);
            var userLocation = new google.maps.Marker({ map: map, position: pos });

            //var circle = document.getElementById("circle");

           /* var markerImage = new google.maps.MarkerImage(
                //circle,
                'myIcon.png',
                new google.maps.Size(10, 10), //size
                null, //origin
                null, //anchor
                new google.maps.Size(10, 10) //scale
            );

            var userMarker = new google.maps.Marker({
                position: pos,
                map: map,
                icon: markerImage //set the markers icon to the MarkerImage
            });

            //when the map zoom changes, resize the icon based on the zoom level so the marker covers the same geographic area
            google.maps.event.addListener(map, 'zoom_changed', function () {

                var pixelSizeAtZoom0 = 2;
                //the size of the icon at zoom level 0
                var maxPixelSize = 350;
                //restricts the maximum size of the icon, otherwise the browser will choke at higher zoom 
                //levels trying to scale an image to millions of pixels

                var zoom = map.getZoom();
                var relativePixelSize = Math.round(pixelSizeAtZoom0 * Math.pow(2, zoom));
                alert("zoom: " + zoom + ", relative pixel size: " + relativePixelSize + ", max pixel size: " + maxPixelSize);
                // use 2 to the power of current zoom to calculate relative pixel size.  Base of exponent is 2 
                //because relative size should double every time you zoom in

                if (relativePixelSize > maxPixelSize) //restrict the maximum size of the icon
                    relativePixelSize = maxPixelSize;

                //change the size of the icon
                userMarker.setIcon(
                    new google.maps.MarkerImage(
                        userMarker.getIcon().url, //marker's same icon graphic
                        null,//size
                        null,//origin
                        null, //anchor
                        new google.maps.Size(relativePixelSize, relativePixelSize) //changes the scale
                    )
                );
            });*/

            // update info on hydrants depending on the map position
            map.addListener('idle', getCenterAndMakeRequest);

        }, function () {
            alert("user disabled geolocation");
            makeServerRequest(pos.lat, pos.lng);

            // update info on hydrants depending on the map position
            map.addListener('idle', getCenterAndMakeRequest);

        });
    } else {
        // if browser doesn't support Geolocation
        handleLocationError(false, map.getCenter());
        makeServerRequest(pos.lat, pos.lng);
    }
}

function handleLocationError(browserHasGeolocation, pos) {
    alert(browserHasGeolocation ?
        'Error: The Geolocation service failed.' :
        'Error: Your browser doesn\'t support geolocation.');
}

function getCenterAndMakeRequest() {
    var c = map.getCenter();
    makeServerRequest(c.lat(), c.lng());
}

function makeServerRequest(mylat, mylong) {

    iconBase = 'Icons_small/';

    /*OverCorridorHydrant   - 0
    UndergroundHydrant      - 1
    PublicWater             - 2
    Well                    - 3
    Cistern                 - 4  */

    icons = {
        0: { icon: iconBase + 'pin_corridorhydrant.png' },
        1: { icon: iconBase + 'pin_undergroundhydrant.png' },
        2: { icon: iconBase + 'pin_public_water.png' },
        3: { icon: iconBase + 'pin_well.png' },
        4: { icon: iconBase + 'pin_cistern.png' },
    };

    request = new XMLHttpRequest();

    bounds = map.getBounds();
    var NE = bounds.getNorthEast();
    var SW = bounds.getSouthWest();

    var url = "http://api.dowser-app.com/api/WaterIntakes?lan=" + NE.lat() + "&las=" + SW.lat()
        + "&loe=" + NE.lng() + "&low=" + SW.lng();

    request.open("GET", url, true);
    request.setRequestHeader("Accept", "application/json");
    request.onreadystatechange = parseJsonResponse;
    request.send();
}

// parses json response from server and draws markers on the map
function parseJsonResponse() {

    var div = document.getElementById('intakes');

    if (request.readyState == 4 && request.status == 200) {

        var response = JSON.parse(request.responseText);
        var count = response.waterIntakes.length;

        // display transparent overlay only with zoom level < 14
        if (map.getZoom() > 14) {
            document.getElementById('panel').style.visibility = 'hidden';
            document.getElementById('panel-text').style.visibility = 'hidden';
            infowindow = new google.maps.InfoWindow();

            for (var i = 0; i < response.waterIntakes.length; i++) {

                var water_intake = response.waterIntakes[i];
                var id = water_intake.id;

                /* div.innerHTML = div.innerHTML + (i + 1) + ": " + water_intake.latitude + ", "
                     + water_intake.longitude + ", type: " + water_intake.waterIntakeType + "<br />";*/

                if (markersIds.indexOf(id) == -1) {

                    var markerCoords = new google.maps.LatLng(water_intake.latitude, water_intake.longitude);
                    var markerType = water_intake.waterIntakeType;
                    var marker = new google.maps.Marker({
                        map: map,
                        position: markerCoords,
                        icon: icons[markerType].icon
                    });
                    markersIds.push(id);
                    gmarkers.push(marker);
                }

                // display info about particular water point
                google.maps.event.addListener(marker, 'click', (function (marker, i) {
                    return function () {
                        infowindow.setContent("Id: " + markersIds[i]);
                        infowindow.open(map, marker);
                    }
                })(marker, i));
            }

            console.log(markersIds);

        } else {

            removeMarkers();
            gmarkers = [];
            markersIds = [];

            var beginning;
            var end = "</b> in this map area. " + "Zoom in or enter an address to display single locations";
            if (count == 1) {
                beginning = "There is " + " <b>" + count + " water intake";
            } else {
                beginning = "There are " + " <b>" + count + " water intakes";
            }

            document.getElementById('panel-text').innerHTML = beginning + end;
            document.getElementById('panel-text').style.visibility = 'visible';
            document.getElementById('panel').style.visibility = 'visible';
        }
    }
}

function removeMarkers() {
    for (i = 0; i < gmarkers.length; i++) {
        gmarkers[i].setMap(null);
    }
}

// this function is from google
// https://developers.google.com/maps/documentation/javascript/examples/places-searchbox
function showSearchResults() {

    var markers = [];
    // Listen for the event fired when the user selects a prediction and retrieve
    // more details for that place.
    searchBox.addListener('places_changed', function () {
        var places = searchBox.getPlaces();

        if (places.length == 0) {
            return;
        }

        // Clear out the old markers.
        markers.forEach(function (marker) {
            marker.setMap(null);
        });
        markers = [];

        // For each place, get the icon, name and location.
        var bounds = new google.maps.LatLngBounds();
        places.forEach(function (place) {
            if (!place.geometry) {
                console.log("Returned place contains no geometry");
                return;
            }
            var icon = {
                url: place.icon,
                size: new google.maps.Size(71, 71),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(17, 34),
                scaledSize: new google.maps.Size(25, 25)
            };

            // Create a marker for each place.
            markers.push(new google.maps.Marker({
                map: map,
                icon: icon,
                title: place.name,
                position: place.geometry.location
            }));

            if (place.geometry.viewport) {
                // Only geocodes have viewport.
                bounds.union(place.geometry.viewport);
            } else {
                bounds.extend(place.geometry.location);
            }
        });
        map.fitBounds(bounds);
    });
}