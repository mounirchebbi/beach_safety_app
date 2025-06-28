const axios = require('axios');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || 'b87cedaabede7999b6b157950fe31164';
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  // Get current weather for a center
  async getCurrentWeather(centerId) {
    try {
      // Get center coordinates
      const centerResult = await query(
        'SELECT ST_X(location) as lng, ST_Y(location) as lat, name FROM centers WHERE id = $1',
        [centerId]
      );

      if (centerResult.rows.length === 0) {
        throw new Error('Center not found');
      }

      const { lng, lat, name } = centerResult.rows[0];

      // Fetch from OpenWeatherMap API
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units: 'metric'
        },
        timeout: 10000 // 10 second timeout
      });

      const weatherData = response.data;
      
      // Transform and store in database
      const transformedData = {
        center_id: centerId,
        temperature: weatherData.main.temp,
        feels_like: weatherData.main.feels_like,
        humidity: weatherData.main.humidity,
        pressure: weatherData.main.pressure,
        wind_speed: weatherData.wind.speed,
        wind_direction: weatherData.wind.deg,
        weather_condition: weatherData.weather[0].main,
        visibility: weatherData.visibility / 1000, // Convert to km
        sunrise: new Date(weatherData.sys.sunrise * 1000),
        sunset: new Date(weatherData.sys.sunset * 1000),
        recorded_at: new Date()
      };

      // Store in database
      const storedData = await this.storeWeatherData(transformedData);

      logger.info('Current weather fetched and stored', { 
        centerId, 
        centerName: name,
        temperature: transformedData.temperature,
        condition: transformedData.weather_condition 
      });

      return storedData;
    } catch (error) {
      logger.error('Error fetching current weather:', error.message);
      throw error;
    }
  }

  // Get 5-day forecast
  async getWeatherForecast(centerId) {
    try {
      const centerResult = await query(
        'SELECT ST_X(location) as lng, ST_Y(location) as lat, name FROM centers WHERE id = $1',
        [centerId]
      );

      if (centerResult.rows.length === 0) {
        throw new Error('Center not found');
      }

      const { lng, lat, name } = centerResult.rows[0];

      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units: 'metric'
        },
        timeout: 10000
      });

      const forecasts = response.data.list;
      
      // Process and store forecasts (group by day)
      const dailyForecasts = this.groupForecastsByDay(forecasts);
      
      for (const [date, forecast] of Object.entries(dailyForecasts)) {
        const forecastData = {
          center_id: centerId,
          forecast_date: new Date(date),
          temperature_min: forecast.temp_min,
          temperature_max: forecast.temp_max,
          weather_condition: forecast.condition,
          wind_speed: forecast.wind_speed,
          wind_direction: forecast.wind_direction,
          precipitation_probability: forecast.precipitation_prob,
          humidity: forecast.humidity
        };

        await this.storeForecast(forecastData);
      }

      logger.info('Weather forecast fetched and stored', { 
        centerId, 
        centerName: name,
        forecastDays: Object.keys(dailyForecasts).length 
      });

      return dailyForecasts;
    } catch (error) {
      logger.error('Error fetching weather forecast:', error.message);
      throw error;
    }
  }

  // Group 3-hour forecasts into daily forecasts
  groupForecastsByDay(forecasts) {
    const dailyForecasts = {};

    forecasts.forEach(forecast => {
      const date = new Date(forecast.dt * 1000).toISOString().split('T')[0];
      
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = {
          temp_min: forecast.main.temp_min,
          temp_max: forecast.main.temp_max,
          condition: forecast.weather[0].main,
          wind_speed: forecast.wind.speed,
          wind_direction: forecast.wind.deg,
          precipitation_prob: forecast.pop * 100,
          humidity: forecast.main.humidity
        };
      } else {
        // Update min/max temperatures
        dailyForecasts[date].temp_min = Math.min(dailyForecasts[date].temp_min, forecast.main.temp_min);
        dailyForecasts[date].temp_max = Math.max(dailyForecasts[date].temp_max, forecast.main.temp_max);
      }
    });

    return dailyForecasts;
  }

  // Store weather data in database
  async storeWeatherData(data) {
    const result = await query(
      `INSERT INTO weather_data (
        center_id, temperature, feels_like, humidity, pressure,
        wind_speed, wind_direction, weather_condition, visibility,
        sunrise, sunset, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.center_id, data.temperature, data.feels_like, data.humidity,
        data.pressure, data.wind_speed, data.wind_direction, data.weather_condition,
        data.visibility, data.sunrise, data.sunset, data.recorded_at
      ]
    );

    return result.rows[0];
  }

  // Store forecast data
  async storeForecast(data) {
    const result = await query(
      `INSERT INTO weather_forecasts (
        center_id, forecast_date, temperature_min, temperature_max,
        weather_condition, wind_speed, wind_direction, precipitation_probability, humidity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (center_id, forecast_date) 
      DO UPDATE SET
        temperature_min = EXCLUDED.temperature_min,
        temperature_max = EXCLUDED.temperature_max,
        weather_condition = EXCLUDED.weather_condition,
        wind_speed = EXCLUDED.wind_speed,
        wind_direction = EXCLUDED.wind_direction,
        precipitation_probability = EXCLUDED.precipitation_probability,
        humidity = EXCLUDED.humidity,
        created_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        data.center_id, data.forecast_date, data.temperature_min, data.temperature_max,
        data.weather_condition, data.wind_speed, data.wind_direction,
        data.precipitation_probability, data.humidity
      ]
    );

    return result.rows[0];
  }

  // Get weather history for a center
  async getWeatherHistory(centerId, days = 7) {
    try {
      const result = await query(
        `SELECT * FROM weather_data 
         WHERE center_id = $1 
         AND recorded_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
         ORDER BY recorded_at DESC`,
        [centerId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching weather history:', error.message);
      throw error;
    }
  }

  // Update weather for all active centers (for scheduled updates)
  async updateAllCentersWeather() {
    try {
      const centersResult = await query(
        'SELECT id, name FROM centers WHERE is_active = true'
      );

      const updatePromises = centersResult.rows.map(async (center) => {
        try {
          await this.getCurrentWeather(center.id);
          logger.info('Weather updated for center', { centerId: center.id, centerName: center.name });
        } catch (error) {
          logger.error('Failed to update weather for center', { 
            centerId: center.id, 
            centerName: center.name, 
            error: error.message 
          });
        }
      });

      await Promise.allSettled(updatePromises);
      logger.info('Weather update cycle completed for all centers');
    } catch (error) {
      logger.error('Error in weather update cycle:', error.message);
    }
  }

  // Test API connection
  async testApiConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat: 36.4,
          lon: 10.6167,
          appid: this.apiKey,
          units: 'metric'
        },
        timeout: 5000
      });

      return {
        success: true,
        message: 'OpenWeatherMap API connection successful',
        data: {
          temperature: response.data.main.temp,
          condition: response.data.weather[0].main
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'OpenWeatherMap API connection failed',
        error: error.message
      };
    }
  }
}

module.exports = new WeatherService(); 