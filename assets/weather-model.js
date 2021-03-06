"use strict";

let WeatherModel = {

  openWeatherApiKey: "4211a163bd8258f32fbd3c7ed8d5c12e",

  /*
    Callback to notify of successful AJAX calls.
   */
  successResponseCallback: null,


  /*
    Callback to notiffy of failed AJAX calls.
   */
  failedResponseCallback: null,


  recentLocations: null,

  currentWeather: {
    locationName: null,
    date: null,
    weatherDescription: null,
    weatherIcon: null,
    temperature: null,
    humidity: null,
    windSpeed: null,
    uvIndex: null,
    uvIndexSeverity: null
  },

  /*
    Each object of the format:
      {
        date: "MM/DD"
        weatherDescription: "clear"
        weatherIcon: "[icon URL]"
        temperature: 67.5
        humidity: 56
      }
   */
  fiveDayForecast: [],


  /*
    Initialize the model.
   */
  start() {
    this.loadRecentLocations();
  },


  setCallbacks(successResponseCallback, failedResponseCallback) {
    this.successResponseCallback = successResponseCallback;
    this.failedResponseCallback = failedResponseCallback;
  },


  // --- Getters for the controller ---

  getMostRecentPlace() {
    if (this.recentLocations.length) {
      return this.recentLocations[0];
    } else {
      return null;
    }
  },

  getRecentPlaces() {
    return this.recentLocations;
  },


  getCurrentWeather() {
    return this.currentWeather;
  },


  getFiveDayForecast() {
    return this.fiveDayForecast;
  },


  // --- Methods to manage the recent locations list ---

  /*
    Add a user's search to the front of the array. If the location is
    already there, remove it first.
   */
  addRecentLocation(location) {
    let index = this.recentLocations.indexOf(location);

    if (-1 !== index) {
      this.recentLocations.splice(index, 1);
    }
    this.recentLocations.unshift(location);
    this.saveRecentLocations();
  },


  /*
    Load recent locations from storage or, if it does not exist, create an
    empty array.
   */
  loadRecentLocations() {
    let recentLocations = localStorage.getItem("recentLocations")

    if (recentLocations) {
      this.recentLocations = JSON.parse(recentLocations);
    } else {
      this.recentLocations = [];
      this.saveRecentLocations();
    }
  },


  /*
    Save recent locations to local storage for later use.
   */
  saveRecentLocations() {
    let recentLocations = JSON.stringify(this.recentLocations);
    localStorage.setItem("recentLocations", recentLocations);
  },


  // --- Methods to get information from OpenWeather ---

  /*
    Process a weather search for both current and five day forecast,
    then add the location to the list of recent searches.
   */
  searchWeather(query) {
    this.queryOwCurrentWeather(query);
    this.queryOwFiveDayForecast(query);
    this.addRecentLocation(query);
  },


  /*
    Get the the current weather from OpenWeather.
   */
  queryOwCurrentWeather(query) {
    let queryUrl = this.getApiUrl(query, "weather");

    $.ajax({
      url: queryUrl,
      type: "GET"
    }).then(
      (successResponse) => {
        console.log(successResponse);
        this.setCurrentWeather(successResponse);
        this.queryOpenWeatherUvIndex(successResponse);
        this.successResponseCallback();
      },
      (failedResponse) => {
        this.alertAjaxError(queryUrl, failedResponse);
      }
    );
  },


  /*
    Set the current weather based on the AJAX response.
   */
  setCurrentWeather(response) {
    this.currentWeather.locationName = this.getLocationName(response);
    this.currentWeather.date = this.getWeatherTime(response);
    this.currentWeather.weatherDescription = this.getWeatherDescription(response);
    this.currentWeather.weatherIcon =  this.getWeatherIcon(response);
    this.currentWeather.temperature = this.getTemperature(response);
    this.currentWeather.humidity = this.getHumidity(response);
    this.currentWeather.windSpeed = this.getWindSpeed(response);
  },


  /*
    Get the UV index from OpenWeather by using the (lat,lon) of the
    current weather.
   */
  queryOpenWeatherUvIndex(response) {
    let
      lat = response.coord.lat,
      lon = response.coord.lon,
      queryUrl =`https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${this.openWeatherApiKey}`;

    $.ajax({
      url: queryUrl,
      type: "GET"
    }).then(
      (successResponse) => {
        this.currentWeather.uvIndex = this.getUvIndex(successResponse);
        this.currentWeather.uvIndexSeverity = this.getUvIndexSeverity();
        this.successResponseCallback();

      },
      (failedResponse) => {
        this.alertAjaxError(failedResponse);
      }
    )
  },


  queryOwFiveDayForecast(query) {
    let queryUrl = this.getApiUrl(query, "forecast");

    $.ajax({
      url: queryUrl,
      type: "GET"
    }).then(
      (successResponse) => {
        let days = successResponse.list.filter(day => day.dt_txt.includes("00:00:00"))

        this.fiveDayForecast = [];

        for (let day of days) {
          this.fiveDayForecast.push({
            date: this.getWeatherTime(day, true),
            weatherDescription: this.getWeatherDescription(day),
            weatherIcon: this.getWeatherIcon(day),
            temperature: this.getTemperature(day),
            humidity: this.getHumidity(day)
          });
        }
        this.successResponseCallback();
      },
      (failedResponse) => {
        this.alertAjaxError(queryUrl, failedResponse);
      },
      (completeResponse) => {
        console.log("hello")
        console.log(this.isRequestSuccessful(completeResponse))
      }
    );
  },


  // --- Methods to build the AJAX URLs and respond to errors ---

  /*
    Build an API URL for today's weather or five-day forecasts.
   */
  getApiUrl(query,queryType) {
    let
      baseUrl = "https://api.openweathermap.org/data/2.5/",
      queryString = this.getQueryString(query);

    return baseUrl + queryType + queryString;
  },


  /*
    Return the query string of the API call. If the query is just a number,
    we'll assume it's a zip code.

    During testing, I noticed I'm not getting the expected results for some
    queries. For example, "Washingon, DC" fails, but "Washington, DC, US"
    succeeds. 
   */
  getQueryString(query) {
    if (!query || !query.length) {
      return null;
    }

    let queryString = "";

    if (Number.isInteger(parseInt(query))) {
      queryString = `?zip=${query}`
    } else {
      query = query
        .split(",")
        .map(s => s.trim())
        .map(s => s.toLowerCase())
        .map(s => s.replace(/\s/g, "+"));

      queryString = `?q=${query.join(",")}`
    }
    return queryString + `&appid=${this.openWeatherApiKey}`
  },


  /*
    Send errors to the log and raise an event so we can alert the user.
   */
  alertAjaxError(queryUrl, xhr) {
    console.log("Error on query: %s\n  status: %s\n  message: %s",
      queryUrl,
      xhr.status,
      xhr.responseJSON.message
    );
    this.failedResponseCallback(xhr);
  },


  // --- Methods to simplify extracting information of AJAX results ---

  getLocationName(response) {
    return response.name;
  },


  getWeatherTime(response, useShortDate) {
    let format = useShortDate ? "MMM DD" : "MMMM DD";
    return moment.unix(parseInt(response.dt)).format(format);
  },


  getWeatherDescription(response) {
    return response.weather[0].description;
  },


  getWeatherIcon(response) {
    return `https://openweathermap.org/img/wn/${response.weather[0].icon}.png`;
  },


  getTemperature(response) {
    return this.convertKelvinToFahrenheit(parseFloat(response.main.temp)).toFixed(1);
  },


  getHumidity(response) {
    return parseFloat(response.main.humidity);
  },


  getWindSpeed(response) {
    return this.convertMetersPerSecondToMilesPerHour(parseFloat(response.wind.speed)).toFixed(1);
  },


  getUvIndex(response) {
    return parseFloat(response.value);
  },


  /*
    Categorize the UV index, using guidance here:
      https://www.epa.gov/sunsafety/uv-index-scale-0
   */
  getUvIndexSeverity() {
    let uvIndex = this.currentWeather.uvIndex;

    if (!parseInt(uvIndex)) {
      return "unknown"
    } else if (uvIndex <= 2) {
      return "low";
    } else if (uvIndex <= 7) {
      return "moderate";
    } else {
      return "veryHigh";
    }
  },


  // -- Unit conversion functions --

  convertKelvinToFahrenheit(tempKelvin) {
    return (tempKelvin - 273.15) * 1.80 + 32;
  },

  convertMetersPerSecondToMilesPerHour(speedMps) {
    return speedMps * 2.2369363;
  }
}