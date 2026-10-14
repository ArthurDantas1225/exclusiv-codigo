-- Product photos are public catalog assets. Stable URLs let the Vercel image
-- optimizer cache resized copies instead of repeatedly downloading originals.
update storage.buckets set public = true where id = 'products';
