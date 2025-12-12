"""
Bouquet builder logic
"""
import requests
from config import Config
from rules import apply_composition_rules, generate_bouquet_configurations

config = Config()

def get_available_flowers(token):
    """Get available flowers from inventory service"""
    try:
        response = requests.get(
            f"{config.INVENTORY_SERVICE_URL}/flowers",
            headers={'Authorization': token},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('flowers', [])
        
        return []
    except Exception as e:
        print(f"Error fetching flowers: {e}")
        return []

def check_availability(flower_type_id, quantity, token):
    """Check if specific flower type and quantity is available"""
    try:
        params = {
            'flower_type_id': [flower_type_id],
            'quantity': [quantity]
        }
        
        query_params = f'flower_type_id={flower_type_id}&quantity={quantity}'
        url = f"{config.INVENTORY_SERVICE_URL}/inventory/available?{query_params}"
        
        response = requests.get(
            url,
            headers={'Authorization': token},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            availability = data.get('availability', {})
            flower_availability = availability.get(str(flower_type_id), {})
            return flower_availability.get('sufficient', False)
        
        return False
    except Exception as e:
        print(f"Error checking availability: {e}")
        return False

def validate_bouquet_configuration(configuration, token):
    """Validate a bouquet configuration"""
    if not configuration or 'items' not in configuration:
        return False, "Invalid configuration format"
    
    items = configuration['items']
    
    if not items:
        return False, "Configuration must contain at least one item"
    
    if len(items) < config.MIN_FLOWER_TYPES:
        return False, f"Configuration must contain at least {config.MIN_FLOWER_TYPES} flower types"
    
    total_quantity = sum(item.get('quantity', 0) for item in items)
    
    if total_quantity < config.MIN_FLOWERS_PER_BOUQUET:
        return False, f"Bouquet must contain at least {config.MIN_FLOWERS_PER_BOUQUET} flowers"
    
    if total_quantity > config.MAX_FLOWERS_PER_BOUQUET:
        return False, f"Bouquet cannot contain more than {config.MAX_FLOWERS_PER_BOUQUET} flowers"
    
    # Check availability for each item
    for item in items:
        flower_type_id = item.get('flower_type_id')
        quantity = item.get('quantity', 0)
        
        if not flower_type_id or quantity <= 0:
            return False, "Each item must have a valid flower_type_id and quantity"
        
        if not check_availability(flower_type_id, quantity, token):
            return False, f"Flower type {flower_type_id} is not available in quantity {quantity}"
    
    return True, "Configuration is valid"

def build_bouquet_preview(budget, colors=None, season=None, style=None, token=None):
    """Build bouquet preview configurations"""
    # Get available flowers
    flowers = get_available_flowers(token)
    
    if not flowers:
        return []
    
    # Apply composition rules
    filtered_flowers = apply_composition_rules(
        flowers,
        budget=budget,
        colors=colors,
        season=season,
        style=style
    )
    
    if not filtered_flowers:
        return []
    
    # Generate configurations
    configurations = generate_bouquet_configurations(
        filtered_flowers,
        budget
    )
    
    return configurations

