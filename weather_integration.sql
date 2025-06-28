-- Weather Integration Enhancements for Beach Safety App
-- This file adds OpenWeatherMap API integration capabilities
-- Date: December 28, 2024

-- 1. Add OpenWeatherMap API specific fields to existing weather_data table
ALTER TABLE weather_data 
ADD COLUMN weather_condition VARCHAR(100),
ADD COLUMN humidity DECIMAL(5,2),
ADD COLUMN pressure DECIMAL(8,2),
ADD COLUMN feels_like DECIMAL(5,2),
ADD COLUMN sunrise TIMESTAMP,
ADD COLUMN sunset TIMESTAMP;

-- 2. Create weather alerts table for severe weather warnings
CREATE TABLE weather_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe', 'extreme')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create weather forecast table for 5-day forecasts
CREATE TABLE weather_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    temperature_min DECIMAL(5,2),
    temperature_max DECIMAL(5,2),
    weather_condition VARCHAR(100),
    wind_speed DECIMAL(5,2),
    wind_direction DECIMAL(5,2),
    precipitation_probability DECIMAL(5,2),
    humidity DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(center_id, forecast_date)
);

-- 4. Add indexes for new tables
CREATE INDEX idx_weather_alerts_center_id ON weather_alerts(center_id);
CREATE INDEX idx_weather_alerts_active ON weather_alerts(is_active);
CREATE INDEX idx_weather_alerts_time_range ON weather_alerts(start_time, end_time);
CREATE INDEX idx_weather_forecasts_center_date ON weather_forecasts(center_id, forecast_date);

-- 5. Add triggers for updated_at
CREATE TRIGGER update_weather_alerts_updated_at BEFORE UPDATE ON weather_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_weather_forecasts_updated_at BEFORE UPDATE ON weather_forecasts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Create function to clean old weather data (keep last 30 days)
CREATE OR REPLACE FUNCTION clean_old_weather_data()
RETURNS void AS $$
BEGIN
    DELETE FROM weather_data 
    WHERE recorded_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    DELETE FROM weather_forecasts 
    WHERE forecast_date < CURRENT_DATE;
    
    DELETE FROM weather_alerts 
    WHERE end_time < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 7. Grant permissions to myapp_user
GRANT ALL PRIVILEGES ON TABLE weather_alerts TO myapp_user;
GRANT ALL PRIVILEGES ON TABLE weather_forecasts TO myapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myapp_user;

-- 8. Display completion message
SELECT 'Weather integration database setup completed successfully!' as status; 