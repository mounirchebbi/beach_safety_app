-- Beach Safety Web App Database Setup Script
-- PostgreSQL with PostGIS Extension

-- 1. Create Database User
-- Run this as PostgreSQL superuser (postgres)
CREATE USER myapp_user WITH PASSWORD '123';

-- 2. Create Database
CREATE DATABASE myapp_db OWNER myapp_user;

-- 3. Connect to the new database
\c myapp_db;

-- 4. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 5. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 6. Grant necessary permissions to the user
GRANT ALL PRIVILEGES ON DATABASE myapp_db TO myapp_user;
GRANT ALL ON SCHEMA public TO myapp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myapp_user;

-- 7. Create Tables

-- USERS Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('system_admin', 'center_admin', 'lifeguard')),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- CENTERS Table
CREATE TABLE centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location GEOMETRY(POINT, 4326) NOT NULL,
    address VARCHAR(500),
    phone VARCHAR(20),
    email VARCHAR(255),
    operating_hours JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- LIFEGUARDS Table
CREATE TABLE lifeguards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    certification_level VARCHAR(100),
    certification_expiry DATE,
    emergency_contact JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, center_id)
);

-- SHIFTS Table
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lifeguard_id UUID NOT NULL REFERENCES lifeguards(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
    check_in_time TIMESTAMP,
    check_in_location GEOMETRY(POINT, 4326),
    check_out_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SAFETY_ZONES Table
CREATE TABLE safety_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    zone_type VARCHAR(20) NOT NULL CHECK (zone_type IN ('no_swim', 'caution', 'safe')),
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WEATHER_DATA Table
CREATE TABLE weather_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    temperature DECIMAL(5,2),
    wind_speed DECIMAL(5,2),
    wind_direction DECIMAL(5,2),
    precipitation DECIMAL(5,2),
    wave_height DECIMAL(5,2),
    current_speed DECIMAL(5,2),
    visibility DECIMAL(5,2),
    recorded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SAFETY_FLAGS Table
CREATE TABLE safety_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    flag_status VARCHAR(10) NOT NULL CHECK (flag_status IN ('green', 'yellow', 'red', 'black')),
    reason TEXT,
    set_by UUID NOT NULL REFERENCES users(id),
    set_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EMERGENCY_ALERTS Table
CREATE TABLE emergency_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('sos', 'medical', 'drowning', 'weather')),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    location GEOMETRY(POINT, 4326) NOT NULL,
    description TEXT,
    reported_by VARCHAR(255), -- Anonymous beachgoer or user_id
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'responding', 'resolved', 'closed')),
    assigned_lifeguard_id UUID REFERENCES lifeguards(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INCIDENT_REPORTS Table
CREATE TABLE incident_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES emergency_alerts(id) ON DELETE SET NULL,
    lifeguard_id UUID NOT NULL REFERENCES lifeguards(id) ON DELETE CASCADE,
    incident_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    action_taken TEXT,
    outcome TEXT,
    involved_persons JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create Indexes for Performance

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Centers indexes
CREATE INDEX idx_centers_location ON centers USING GIST(location);
CREATE INDEX idx_centers_is_active ON centers(is_active);

-- Lifeguards indexes
CREATE INDEX idx_lifeguards_center_id ON lifeguards(center_id);
CREATE INDEX idx_lifeguards_user_id ON lifeguards(user_id);

-- Shifts indexes
CREATE INDEX idx_shifts_center_id ON shifts(center_id);
CREATE INDEX idx_shifts_lifeguard_id ON shifts(lifeguard_id);
CREATE INDEX idx_shifts_start_time ON shifts(start_time);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_date_range ON shifts(start_time, end_time);

-- Safety Zones indexes
CREATE INDEX idx_safety_zones_center_id ON safety_zones(center_id);
CREATE INDEX idx_safety_zones_zone_type ON safety_zones(zone_type);
CREATE INDEX idx_safety_zones_geometry ON safety_zones USING GIST(geometry);

-- Weather Data indexes
CREATE INDEX idx_weather_data_center_id ON weather_data(center_id);
CREATE INDEX idx_weather_data_recorded_at ON weather_data(recorded_at);
CREATE INDEX idx_weather_data_center_time ON weather_data(center_id, recorded_at);

-- Safety Flags indexes
CREATE INDEX idx_safety_flags_center_id ON safety_flags(center_id);
CREATE INDEX idx_safety_flags_status ON safety_flags(flag_status);
CREATE INDEX idx_safety_flags_set_at ON safety_flags(set_at);

-- Emergency Alerts indexes
CREATE INDEX idx_emergency_alerts_center_id ON emergency_alerts(center_id);
CREATE INDEX idx_emergency_alerts_status ON emergency_alerts(status);
CREATE INDEX idx_emergency_alerts_created_at ON emergency_alerts(created_at);
CREATE INDEX idx_emergency_alerts_location ON emergency_alerts USING GIST(location);
CREATE INDEX idx_emergency_alerts_assigned ON emergency_alerts(assigned_lifeguard_id);

-- Incident Reports indexes
CREATE INDEX idx_incident_reports_lifeguard_id ON incident_reports(lifeguard_id);
CREATE INDEX idx_incident_reports_alert_id ON incident_reports(alert_id);
CREATE INDEX idx_incident_reports_created_at ON incident_reports(created_at);

-- 9. Create Updated At Triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_centers_updated_at BEFORE UPDATE ON centers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lifeguards_updated_at BEFORE UPDATE ON lifeguards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_safety_zones_updated_at BEFORE UPDATE ON safety_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_safety_flags_updated_at BEFORE UPDATE ON safety_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emergency_alerts_updated_at BEFORE UPDATE ON emergency_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incident_reports_updated_at BEFORE UPDATE ON incident_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Insert Sample Data (Optional)

-- Insert a system admin user
INSERT INTO users (email, password_hash, role, first_name, last_name, phone) 
VALUES ('admin@beachsafety.com', '$2b$10$example_hash_here', 'system_admin', 'System', 'Administrator', '+1234567890');

-- Insert sample centers (you'll need to provide actual coordinates)
INSERT INTO centers (name, description, location, address, phone, email, operating_hours) 
VALUES 
('Main Beach Center', 'Primary lifeguard center for main beach area', ST_GeomFromText('POINT(-118.4912 34.0224)', 4326), '123 Beach Blvd, Santa Monica, CA', '+1234567891', 'main@beachsafety.com', '{"monday": {"open": "06:00", "close": "20:00"}, "tuesday": {"open": "06:00", "close": "20:00"}, "wednesday": {"open": "06:00", "close": "20:00"}, "thursday": {"open": "06:00", "close": "20:00"}, "friday": {"open": "06:00", "close": "20:00"}, "saturday": {"open": "06:00", "close": "20:00"}, "sunday": {"open": "06:00", "close": "20:00"}}'),
('North Beach Center', 'Lifeguard center for north beach area', ST_GeomFromText('POINT(-118.4812 34.0324)', 4326), '456 North Beach Rd, Santa Monica, CA', '+1234567892', 'north@beachsafety.com', '{"monday": {"open": "06:00", "close": "20:00"}, "tuesday": {"open": "06:00", "close": "20:00"}, "wednesday": {"open": "06:00", "close": "20:00"}, "thursday": {"open": "06:00", "close": "20:00"}, "friday": {"open": "06:00", "close": "20:00"}, "saturday": {"open": "06:00", "close": "20:00"}, "sunday": {"open": "06:00", "close": "20:00"}}');

-- 11. Grant final permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myapp_user;

-- 12. Display setup completion message
SELECT 'Database setup completed successfully!' as status; 