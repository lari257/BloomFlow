"""
Bouquet composition rules
"""
from datetime import datetime
from config import Config

config = Config()

# Color compatibility matrix
COLOR_COMPATIBILITY = {
    'red': ['white', 'pink', 'yellow', 'orange'],
    'pink': ['white', 'red', 'purple', 'yellow'],
    'white': ['red', 'pink', 'yellow', 'blue', 'purple', 'orange'],
    'yellow': ['red', 'pink', 'white', 'orange', 'blue'],
    'orange': ['red', 'yellow', 'white'],
    'purple': ['pink', 'white', 'blue'],
    'blue': ['white', 'purple', 'yellow']
}

# Season mapping
SEASONS = {
    'spring': ['march', 'april', 'may'],
    'summer': ['june', 'july', 'august'],
    'autumn': ['september', 'october', 'november'],
    'winter': ['december', 'january', 'february']
}

def get_current_season():
    """Get current season"""
    month = datetime.now().strftime('%B').lower()
    
    for season, months in SEASONS.items():
        if month in months:
            return season
    
    return 'all'

def is_color_compatible(color1, color2):
    """Check if two colors are compatible"""
    if not color1 or not color2:
        return True  # If color is not specified, assume compatible
    
    color1_lower = color1.lower()
    color2_lower = color2.lower()
    
    # Same color is always compatible
    if color1_lower == color2_lower:
        return True
    
    # Check compatibility matrix
    compatible_colors = COLOR_COMPATIBILITY.get(color1_lower, [])
    return color2_lower in compatible_colors

def is_seasonal(flower_seasonality, requested_season=None):
    """Check if flower is in season"""
    if not flower_seasonality or flower_seasonality.lower() == 'all':
        return True
    
    if not requested_season:
        requested_season = get_current_season()
    
    return flower_seasonality.lower() == requested_season.lower()

def filter_by_budget(flowers, budget):
    """Filter flowers that fit within budget"""
    if not budget or budget <= 0:
        return flowers
    
    # Filter flowers where price per unit is reasonable for the budget
    # Assume we want at least 3 flowers, so max price per unit should be budget/3
    max_price_per_unit = budget / config.MIN_FLOWERS_PER_BOUQUET
    
    return [f for f in flowers if f.get('price_per_unit', 0) <= max_price_per_unit]

def filter_by_colors(flowers, requested_colors):
    """Filter flowers by color compatibility"""
    if not requested_colors:
        return flowers
    
    if isinstance(requested_colors, str):
        requested_colors = [c.strip() for c in requested_colors.split(',')]
    
    filtered = []
    for flower in flowers:
        flower_color = flower.get('color', '').lower() if flower.get('color') else None
        
        # If no color specified, include it
        if not flower_color:
            filtered.append(flower)
            continue
        
        # Check if flower color is compatible with any requested color
        for req_color in requested_colors:
            if is_color_compatible(flower_color, req_color.lower()):
                filtered.append(flower)
                break
    
    return filtered

def filter_by_season(flowers, season=None):
    """Filter flowers by seasonality"""
    if not season:
        season = get_current_season()
    
    return [f for f in flowers if is_seasonal(f.get('seasonality'), season)]

def apply_composition_rules(flowers, budget=None, colors=None, season=None, style=None):
    """Apply all composition rules to filter flowers"""
    filtered = flowers.copy()
    
    # Apply filters in order
    if budget:
        filtered = filter_by_budget(filtered, budget)
    
    if season:
        filtered = filter_by_season(filtered, season)
    
    if colors:
        filtered = filter_by_colors(filtered, colors)
    
    return filtered

def generate_bouquet_configurations(available_flowers, budget, min_flowers=None, max_flowers=None):
    """Generate valid bouquet configurations"""
    if not available_flowers:
        return []
    
    min_flowers = min_flowers or config.MIN_FLOWERS_PER_BOUQUET
    max_flowers = max_flowers or config.MAX_FLOWERS_PER_BOUQUET
    
    configurations = []
    
    # Sort flowers by price (ascending)
    sorted_flowers = sorted(available_flowers, key=lambda x: x.get('price_per_unit', 0))
    
    # Generate configurations with different flower type combinations
    # Simple approach: try combinations of 2-8 flower types
    for num_types in range(config.MIN_FLOWER_TYPES, min(config.MAX_FLOWER_TYPES + 1, len(sorted_flowers) + 1)):
        # Select first num_types flowers (cheapest)
        selected_flowers = sorted_flowers[:num_types]
        
        # Calculate quantities to fit budget
        total_price = sum(f.get('price_per_unit', 0) for f in selected_flowers)
        
        if total_price == 0:
            continue
        
        # Calculate how many of each we can afford
        quantities = {}
        remaining_budget = budget
        total_quantity = 0
        
        for flower in selected_flowers:
            price = flower.get('price_per_unit', 0)
            if price > 0:
                # Distribute budget proportionally
                flower_budget = (price / total_price) * budget
                qty = max(1, int(flower_budget / price))
                quantities[flower['id']] = qty
                remaining_budget -= qty * price
                total_quantity += qty
        
        # Adjust if we're over budget
        if remaining_budget < 0:
            # Reduce quantities proportionally
            scale_factor = budget / (budget - remaining_budget)
            for flower_id in quantities:
                quantities[flower_id] = max(1, int(quantities[flower_id] * scale_factor))
        
        # Check if configuration meets minimum requirements
        if total_quantity >= min_flowers and total_quantity <= max_flowers:
            config_items = []
            config_total = 0
            
            for flower in selected_flowers:
                flower_id = flower['id']
                qty = quantities.get(flower_id, 0)
                if qty > 0:
                    unit_price = flower.get('price_per_unit', 0)
                    config_items.append({
                        'flower_type_id': flower_id,
                        'flower_name': flower.get('name'),
                        'quantity': qty,
                        'unit_price': unit_price,
                        'subtotal': qty * unit_price
                    })
                    config_total += qty * unit_price
            
            if config_items:
                configurations.append({
                    'items': config_items,
                    'total_price': config_total,
                    'total_flowers': sum(item['quantity'] for item in config_items),
                    'flower_types_count': len(config_items)
                })
    
    # Sort by total price (ascending)
    configurations.sort(key=lambda x: x['total_price'])
    
    # Return top 5 configurations
    return configurations[:5]

