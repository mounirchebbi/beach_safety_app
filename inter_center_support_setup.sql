-- Inter-Center Support Database Setup
-- This file adds the missing tables for inter-center support functionality
-- Date: December 28, 2024

-- 1. Create emergency escalations table
CREATE TABLE emergency_escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    escalation_type VARCHAR(50) NOT NULL CHECK (escalation_type IN ('medical', 'security', 'weather', 'equipment', 'personnel', 'coordination')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'closed')),
    created_by UUID NOT NULL REFERENCES users(id),
    acknowledged_by UUID REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create inter-center support requests table
CREATE TABLE inter_center_support_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requesting_center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    requesting_admin_id UUID NOT NULL REFERENCES users(id),
    target_center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    escalation_id UUID REFERENCES emergency_escalations(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('personnel_support', 'equipment_support', 'medical_support', 'evacuation_support', 'coordination_support')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requested_resources JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'responding', 'resolved', 'declined', 'cancelled')),
    acknowledged_by UUID REFERENCES users(id),
    declined_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add indexes for performance
CREATE INDEX idx_emergency_escalations_center_id ON emergency_escalations(center_id);
CREATE INDEX idx_emergency_escalations_status ON emergency_escalations(status);
CREATE INDEX idx_emergency_escalations_priority ON emergency_escalations(priority);
CREATE INDEX idx_emergency_escalations_created_at ON emergency_escalations(created_at);

CREATE INDEX idx_inter_center_support_requests_requesting_center ON inter_center_support_requests(requesting_center_id);
CREATE INDEX idx_inter_center_support_requests_target_center ON inter_center_support_requests(target_center_id);
CREATE INDEX idx_inter_center_support_requests_status ON inter_center_support_requests(status);
CREATE INDEX idx_inter_center_support_requests_priority ON inter_center_support_requests(priority);
CREATE INDEX idx_inter_center_support_requests_created_at ON inter_center_support_requests(created_at);
CREATE INDEX idx_inter_center_support_requests_requesting_admin ON inter_center_support_requests(requesting_admin_id);

-- 4. Add triggers for updated_at
CREATE TRIGGER update_emergency_escalations_updated_at BEFORE UPDATE ON emergency_escalations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inter_center_support_requests_updated_at BEFORE UPDATE ON inter_center_support_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Grant permissions to myapp_user
GRANT ALL PRIVILEGES ON TABLE emergency_escalations TO myapp_user;
GRANT ALL PRIVILEGES ON TABLE inter_center_support_requests TO myapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myapp_user;

-- 6. Display completion message
SELECT 'Inter-center support database setup completed successfully!' as status; 