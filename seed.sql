-- Seed data for restaurant_tables
INSERT INTO restaurant_tables (table_number, token, is_active) VALUES
(1, 'abc123', true),
(2, 'def456', true),
(3, 'ghi789', true),
(4, 'jkl012', true),
(5, 'mno345', true)
ON CONFLICT (table_number) DO UPDATE 
SET token = EXCLUDED.token, is_active = EXCLUDED.is_active;

-- Seed data for menu_items
INSERT INTO menu_items (name, description, price, category, image_url, is_available) VALUES
-- Shakes
('Belgian Cocoa Shake', 'Double chocolate, rich Belgian ganache, whipped house cream tower.', 280, 'Shakes', NULL, true),
('Biscoff Storm Shake', 'Caramelised Speculoos cookie blend, real vanilla bean, crushed biscuit.', 320, 'Shakes', NULL, true),
('Oreo Royale Shake', 'Thick blended crushed cocoa cookies, signature cream, dark chocolate drizzle.', 260, 'Shakes', NULL, true),
('Strawberry Cloud Shake', 'Freshly muddled strawberries, velvety house cream, white chocolate curls.', 240, 'Shakes', NULL, true),
('Cold Brew Float', 'Slow-dripped cold brew coffee, a scoop of Madagascar vanilla gelato, gold dust.', 280, 'Shakes', NULL, true),

-- Coffee
('Single-Origin Espresso', 'Intense and aromatic shot brewed from premium hand-picked Arabica beans.', 180, 'Coffee', NULL, true),
('Pistachio Royale Latte', 'Creamy espresso infusion with sweet Sicilian pistachio paste and sea salt.', 240, 'Coffee', NULL, true),
('Gold Dust Cappuccino', 'Classic cappuccino finished with hand-piped foam and a dusting of edible 24k gold leaf.', 260, 'Coffee', NULL, true),
('Affogato al Caffe', 'A double shot of hot espresso poured over a scoop of premium Madagascar vanilla bean gelato.', 220, 'Coffee', NULL, true),

-- Mocktails
('Rose Lychee Fizz', 'Persian rose syrup, sweet lychee nectar, sparkling tonic, fresh mint leaves.', 220, 'Mocktails', NULL, true),
('Crimson Mint Cooler', 'Muddled fresh raspberries, lime juice, mint leaves, topped with ginger beer.', 210, 'Mocktails', NULL, true),
('Blue Butterfly Pea Mojito', 'Natural butterfly pea flower tea, fresh lime, mint, pure cane syrup, sparkling water.', 230, 'Mocktails', NULL, true),

-- Starters
('Truffle Parmesan Fries', 'Golden hand-cut potatoes tossed in aromatic black truffle oil, rosemary, and aged Parmesan.', 290, 'Starters', NULL, true),
('Mozzarella Golden Sticks', 'Crispy herb-crusted mozzarella sticks served with a spicy fire-roasted marinara dip.', 310, 'Starters', NULL, true),
('Creamy Corn Croquettes', 'Sweet corn and smooth bechamel croquettes, deep-fried to a perfect gold, served with garlic aioli.', 280, 'Starters', NULL, true),

-- Main Course
('Wild Mushroom Risotto', 'Creamy Arborio rice cooked slowly with porcini, button mushrooms, white wine, and Parmesan.', 480, 'Main Course', NULL, true),
('Saffron Alfredo Penne', 'Penne pasta tossed in a luxurious saffron-infused cream cheese sauce with roasted cherry tomatoes.', 450, 'Main Course', NULL, true),
('Pesto Caprese Flatbread', 'Artisan flatbread baked with fresh basil pesto, heirloom tomatoes, and buffalo mozzarella.', 420, 'Main Course', NULL, true),

-- Desserts
('Molten Belgian Brownie', 'Slow-baked Belgian cocoa brownie, warm chocolate center, vanilla bean cream, gold leaf.', 340, 'Desserts', NULL, true),
('Velvet Berry Cheesecake', 'Hand-whipped Italian mascarpone cheesecake, wild berry confit, buttery almond sablé base.', 360, 'Desserts', NULL, true),
('Crystal Berry Sundae', 'Cinematic five-scoop artisan gelato tower, salted caramel ribbons, fresh summer berries.', 380, 'Desserts', NULL, true)
ON CONFLICT (id) DO NOTHING;
