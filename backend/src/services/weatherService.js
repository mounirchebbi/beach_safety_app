const axios = require('axios');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || 'b87cedaabede7999b6b157950fe31164';
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    // Add Stormglass API key for marine data (optional)
    this.stormglassApiKey = process.env.STORMGLASS_API_KEY;
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
      
      // Log raw API response for debugging
      logger.info('Raw OpenWeatherMap API response', {
        centerId,
        centerName: name,
        coordinates: { lat, lng },
        visibility: weatherData.visibility,
        weather_condition: weatherData.weather?.[0]?.main,
        temperature: weatherData.main?.temp,
        wind_speed: weatherData.wind?.speed,
        humidity: weatherData.main?.humidity,
        pressure: weatherData.main?.pressure,
        raw_response: {
          visibility: weatherData.visibility,
          weather: weatherData.weather,
          main: weatherData.main,
          wind: weatherData.wind
        }
      });
      
      // Fetch marine data
      const marineData = await this.getMarineData(lat, lng);
      
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
        wave_height: marineData.wave_height,
        current_speed: marineData.current_speed,
        sunrise: new Date(weatherData.sys.sunrise * 1000),
        sunset: new Date(weatherData.sys.sunset * 1000),
        recorded_at: new Date()
      };

      // Log transformed data for debugging
      logger.info('Transformed weather data', {
        centerId,
        centerName: name,
        original_visibility_meters: weatherData.visibility,
        transformed_visibility_km: transformedData.visibility,
        temperature: transformedData.temperature,
        wind_speed: transformedData.wind_speed,
        weather_condition: transformedData.weather_condition,
        wave_height: transformedData.wave_height,
        current_speed: transformedData.current_speed
      });

      // Store in database
      const storedData = await this.storeWeatherData(transformedData);

      logger.info('Current weather and marine data fetched and stored', { 
        centerId, 
        centerName: name,
        temperature: transformedData.temperature,
        condition: transformedData.weather_condition,
        waveHeight: transformedData.wave_height,
        currentSpeed: transformedData.current_speed
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

  // Store weather data
  async storeWeatherData(data) {
    // Clean old weather data (older than 1 hour)
    await query(
      'DELETE FROM weather_data WHERE center_id = $1 AND recorded_at < CURRENT_TIMESTAMP - INTERVAL \'1 hour\'',
      [data.center_id]
    );

    // Insert new weather record
    const result = await query(
      `INSERT INTO weather_data (
        center_id, temperature, feels_like, humidity, pressure,
        wind_speed, wind_direction, weather_condition, visibility,
        wave_height, current_speed, precipitation, sunrise, sunset, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        data.center_id, data.temperature, data.feels_like, data.humidity,
        data.pressure, data.wind_speed, data.wind_direction, data.weather_condition,
        data.visibility, data.wave_height, data.current_speed, data.precipitation || 0,
        data.sunrise, data.sunset, data.recorded_at
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

      // Now update safety flags automatically for all centers
      const flagUpdatePromises = centersResult.rows.map(async (center) => {
        try {
          const flagResult = await this.updateSafetyFlagAutomatically(center.id);
          if (flagResult.updated) {
            logger.info('Safety flag updated automatically for center', { 
              centerId: center.id, 
              centerName: center.name,
              oldFlag: flagResult.old_flag,
              newFlag: flagResult.new_flag
            });
          }
        } catch (error) {
          logger.error('Failed to update safety flag for center', { 
            centerId: center.id, 
            centerName: center.name, 
            error: error.message 
          });
        }
      });

      await Promise.allSettled(flagUpdatePromises);
      logger.info('Automatic safety flag update cycle completed for all centers');
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

  // Automatically determine safety flag status based on weather conditions
  determineSafetyFlag(weatherData) {
    const alerts = [];
    
    // Log weather data used for flag determination
    logger.info('Weather data for flag determination', {
      visibility: weatherData.visibility,
      temperature: weatherData.temperature,
      wind_speed: weatherData.wind_speed,
      wave_height: weatherData.wave_height,
      precipitation: weatherData.precipitation,
      weather_condition: weatherData.weather_condition
    });
    
    // Check wave height
    if (weatherData.wave_height && weatherData.wave_height > 3) {
      alerts.push({
        type: 'wave',
        severity: 'high',
        description: `Dangerous wave conditions. Wave height: ${weatherData.wave_height}m`
      });
    }
    
    // Check wind speed
    if (weatherData.wind_speed && weatherData.wind_speed > 25) {
      alerts.push({
        type: 'wind',
        severity: 'high',
        description: `Strong winds detected. Wind speed: ${weatherData.wind_speed} km/h`
      });
    }
    
    // Check visibility
    if (weatherData.visibility && weatherData.visibility < 10) {
      alerts.push({
        type: 'visibility',
        severity: 'critical',
        description: `Poor visibility conditions. Visibility: ${weatherData.visibility}km`
      });
    }
    
    // Check precipitation
    if (weatherData.precipitation && weatherData.precipitation > 10) {
      alerts.push({
        type: 'rain',
        severity: 'medium',
        description: `Heavy rainfall detected. Precipitation: ${weatherData.precipitation}mm`
      });
    }
    
    // Check temperature
    if (weatherData.temperature && weatherData.temperature > 35) {
      alerts.push({
        type: 'heat',
        severity: 'medium',
        description: `High temperature detected. Temperature: ${weatherData.temperature}°C`
      });
    }

    // Log alerts generated
    logger.info('Alerts generated for flag determination', {
      total_alerts: alerts.length,
      alerts: alerts.map(alert => ({
        type: alert.type,
        severity: alert.severity,
        description: alert.description
      }))
    });

    // Determine flag status based on alerts
    let flagStatus = 'green';
    let reason = 'Safe conditions for beach activities';
    
    if (alerts.length > 0) {
      // Find the highest severity alert
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      const highAlerts = alerts.filter(a => a.severity === 'high');
      const mediumAlerts = alerts.filter(a => a.severity === 'medium');
      
      if (criticalAlerts.length > 0) {
        flagStatus = 'black';
        reason = `CRITICAL: ${criticalAlerts[0].description}`;
      } else if (highAlerts.length > 0) {
        flagStatus = 'red';
        reason = `DANGEROUS: ${highAlerts[0].description}`;
      } else if (mediumAlerts.length > 0) {
        flagStatus = 'yellow';
        reason = `CAUTION: ${mediumAlerts[0].description}`;
      }
    }

    return {
      flag_status: flagStatus,
      reason: reason,
      alerts: alerts,
      weather_conditions: weatherData
    };
  }

  // Automatically update safety flag based on weather conditions
  async updateSafetyFlagAutomatically(centerId, userId = null) {
    try {
      // Get current weather for the center
      const weatherData = await this.getCurrentWeather(centerId);
      
      // Determine appropriate flag status
      const flagDecision = this.determineSafetyFlag(weatherData);
      
      // Get current flag to compare
      const currentFlagResult = await query(
        `SELECT id, flag_status, reason FROM safety_flags 
         WHERE center_id = $1 
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         ORDER BY set_at DESC 
         LIMIT 1`,
        [centerId]
      );

      const currentFlag = currentFlagResult.rows[0];
      
      // Only update if flag status has changed or no current flag exists
      if (!currentFlag || currentFlag.flag_status !== flagDecision.flag_status) {
        // Get system admin user ID for automatic updates
        const systemUserResult = await query(
          'SELECT id FROM users WHERE role = $1 LIMIT 1',
          ['system_admin']
        );
        
        const systemUserId = systemUserResult.rows[0]?.id || '83ba790b-dd5c-4c98-ae16-744cc83d39c2';
        
        // Set the new flag
        const result = await query(
          `INSERT INTO safety_flags (center_id, flag_status, reason, set_by, expires_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            centerId, 
            flagDecision.flag_status, 
            flagDecision.reason, 
            userId || systemUserId, // Use provided user ID or system admin
            new Date(Date.now() + 2 * 60 * 60 * 1000) // Expires in 2 hours
          ]
        );

        logger.info('Safety flag updated automatically', {
          centerId,
          oldFlag: currentFlag?.flag_status || 'none',
          newFlag: flagDecision.flag_status,
          reason: flagDecision.reason,
          alerts: flagDecision.alerts.length
        });

        return {
          updated: true,
          old_flag: currentFlag?.flag_status || 'none',
          new_flag: flagDecision.flag_status,
          reason: flagDecision.reason,
          alerts: flagDecision.alerts
        };
      }

      return {
        updated: false,
        current_flag: currentFlag?.flag_status || 'none',
        reason: currentFlag?.reason || 'No change needed'
      };
    } catch (error) {
      logger.error('Error updating safety flag automatically:', error);
      throw error;
    }
  }

  // Get marine data (wave height and current speed)
  async getMarineData(lat, lng) {
    try {
      // Always use simulation for now
      const simulated = this.simulateMarineData(lat, lng);
      logger.info('Simulated marine data', simulated);
      return simulated;
    } catch (error) {
      logger.warn('Could not fetch marine data, using simulation:', error.message);
      return this.simulateMarineData(lat, lng);
    }
  }

  // Simulate realistic marine data
  simulateMarineData(lat, lng) {
    // Generate realistic wave height (0.1 to 3.0 meters)
    const baseWaveHeight = 0.5;
    const waveVariation = Math.sin(Date.now() / 1000000) * 0.5;
    const windFactor = Math.random() * 0.8;
    const waveHeight = Math.max(0.1, Math.min(3.0, baseWaveHeight + waveVariation + windFactor));

    // Generate realistic current speed (0.1 to 2.0 m/s)
    const baseCurrentSpeed = 0.3;
    const currentVariation = Math.cos(Date.now() / 2000000) * 0.2;
    const tideFactor = Math.random() * 0.4;
    const currentSpeed = Math.max(0.1, Math.min(2.0, baseCurrentSpeed + currentVariation + tideFactor));

    return {
      wave_height: parseFloat(waveHeight.toFixed(2)),
      current_speed: parseFloat(currentSpeed.toFixed(2))
    };
  }
}

module.exports = new WeatherService(); 