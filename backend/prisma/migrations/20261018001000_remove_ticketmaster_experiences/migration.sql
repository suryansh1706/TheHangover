DELETE FROM "Experience"
WHERE "source" ILIKE '%ticketmaster%'
   OR "slug" ILIKE 'ticketmaster-%'
   OR "sourceUrl" ILIKE '%ticketmaster%'
   OR "bookingUrl" ILIKE '%ticketmaster%';
