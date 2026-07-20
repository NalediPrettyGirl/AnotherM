
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    whatsapp = models.CharField(max_length=20, blank=True, null=True)
    # email, username, first_name, last_name, password are included in AbstractUser
    # 'name' and 'surname' in JS API will map to first_name and last_name

    def __str__(self):
        return self.username

class Category(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    imageUrl = models.URLField(max_length=1000, blank=True, null=True)
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Product(models.Model):
    title = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    # Storing category as charfield for now if they sent ID as string, but ForeignKey is better.
    # The express app didn't specify foreign keys explicitly, just 'category' string.
    category = models.CharField(max_length=255) 
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='products')
    imageUrl = models.CharField(max_length=1000, blank=True, null=True)
    main_images = models.JSONField(default=list, blank=True)
    extra_images = models.JSONField(default=list, blank=True)
    
    # other fields they might have sent in the body
    description = models.TextField(blank=True, null=True)
    
    # Missing fields from the frontend list-attire form
    contact_email = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=50, blank=True, null=True)
    province = models.CharField(max_length=100, blank=True, null=True)
    size = models.CharField(max_length=50, blank=True, null=True)
    style = models.JSONField(default=list, blank=True)
    color = models.CharField(max_length=100, blank=True, null=True)
    designer = models.CharField(max_length=255, blank=True, null=True)
    year = models.IntegerField(blank=True, null=True)
    condition = models.CharField(max_length=50, blank=True, null=True)

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class ProductView(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='views')
    dateString = models.CharField(max_length=20) # yyyy-mm-dd
    timestamp = models.DateTimeField(auto_now_add=True)

class Order(models.Model):
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    totalAmount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=50, default='pending')
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)

class Chat(models.Model):
    id = models.CharField(max_length=100, primary_key=True) # They generated custom IDs in JS
    product = models.ForeignKey(Product, on_delete=models.CASCADE, null=True, blank=True)
    productTitle = models.CharField(max_length=255, blank=True, null=True)
    productImage = models.CharField(max_length=1000, blank=True, null=True)
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='seller_chats', null=True, blank=True)
    buyerName = models.CharField(max_length=255, blank=True, null=True)
    buyerEmail = models.EmailField(blank=True, null=True)
    buyerPhone = models.CharField(max_length=50, blank=True, null=True)
    messages = models.JSONField(default=list, blank=True)
    updatedAt = models.DateTimeField(auto_now=True)
