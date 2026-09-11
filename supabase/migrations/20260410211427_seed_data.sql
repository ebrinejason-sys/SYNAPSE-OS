-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260410211427  name: seed_data
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Seed Products
INSERT INTO public.products (name, price, category, image_url, stock_status) VALUES
('Fresh Tomatoes (1kg)', 4500, 'Groceries', 'https://images.unsplash.com/photo-1546470427-f5b9c4c7e03a?auto=format&fit=crop&w=300&q=80', 'In stock'),
('Local Eggs (Tray)', 12000, 'Groceries', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=300&q=80', 'Low stock'),
('White Bread', 2500, 'Groceries', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', 'In stock'),
('Nile Special (500ml)', 4000, 'Drinks', 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=300&q=80', 'In stock'),
('Rolex (Single)', 1500, 'Restaurant Meals', 'https://images.unsplash.com/photo-1610450531580-0a02797400f0?auto=format&fit=crop&w=300&q=80', 'In stock'),
('Beef Pilau', 12000, 'Restaurant Meals', 'https://images.unsplash.com/photo-1567103472667-6898f3a83cd2?auto=format&fit=crop&w=300&q=80', 'In stock');

INSERT INTO public.products (name, price, category, image_url, stock_status, is_gas) VALUES
('6kg Gas Refill', 55000, 'Gas Refills', 'https://images.unsplash.com/photo-1599839620453-9993309a4a75?auto=format&fit=crop&w=300&q=80', 'In stock', TRUE),
('12kg Gas Refill', 105000, 'Gas Refills', 'https://images.unsplash.com/photo-1599839620453-9993309a4a75?auto=format&fit=crop&w=300&q=80', 'In stock', TRUE);

-- Seed Restaurants
INSERT INTO public.restaurants (name, rating, delivery_time, image_url) VALUES
('Mama Africa Kitchen', 4.8, '15-25 min', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'),
('The Rolex King', 4.5, '10-20 min', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'),
('Boda Burgers', 4.2, '20-30 min', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80');
