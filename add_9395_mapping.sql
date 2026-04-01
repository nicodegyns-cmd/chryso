-- Add 9395 code to Permanence INFI mapping
INSERT INTO activity_ebrigade_mappings (activity_id, ebrigade_analytic_name) 
VALUES (4, '9395')
ON CONFLICT DO NOTHING;

-- Verify it was added
SELECT activity_id, ebrigade_analytic_name FROM activity_ebrigade_mappings WHERE activity_id = 4 ORDER BY ebrigade_analytic_name;
