from rest_framework import serializers
from .models import HousingCost, HousingScenario


class HousingCostSerializer(serializers.ModelSerializer):
    class Meta:
        model = HousingCost
        fields = ['id', 'category', 'amount']


class HousingScenarioSerializer(serializers.ModelSerializer):
    additional_costs = HousingCostSerializer(many=True, required=False)
    financing_amount = serializers.SerializerMethodField()
    monthly_instalment = serializers.SerializerMethodField()
    total_monthly_cost = serializers.SerializerMethodField()

    class Meta:
        model = HousingScenario
        fields = [
            'id', 'property_price', 'deposit', 'financing_rate', 'tenure_years',
            'known_monthly_payment', 'additional_costs', 'financing_amount',
            'monthly_instalment', 'total_monthly_cost', 'created_at', 'updated_at',
        ]

    def create(self, validated_data):
        costs = validated_data.pop('additional_costs', [])
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
        scenario = HousingScenario.objects.create(**validated_data)
        for cost in costs:
            HousingCost.objects.create(scenario=scenario, **cost)
        return scenario

    def update(self, instance, validated_data):
        costs = validated_data.pop('additional_costs', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if costs is not None:
            instance.additional_costs.all().delete()
            for cost in costs:
                HousingCost.objects.create(scenario=instance, **cost)
        return instance

    def get_financing_amount(self, obj):
        from .services import financing_amount
        return round(financing_amount(obj.property_price, obj.deposit), 2)

    def get_monthly_instalment(self, obj):
        from .services import scenario_instalment
        return round(scenario_instalment(obj), 2)

    def get_total_monthly_cost(self, obj):
        from .services import scenario_total_monthly_cost
        return round(scenario_total_monthly_cost(obj), 2)


class HousingCalculationSerializer(serializers.Serializer):
    property_price = serializers.FloatField(min_value=0)
    deposit = serializers.FloatField(min_value=0)
    financing_rate = serializers.FloatField(min_value=0)
    tenure_years = serializers.IntegerField(min_value=1)
    known_monthly_payment = serializers.FloatField(min_value=0, allow_null=True, required=False)
    additional_costs = serializers.ListField(child=serializers.DictField(), required=False)


class PreHousingCheckSerializer(serializers.Serializer):
    income = serializers.ListField(child=serializers.DictField())
    work_costs = serializers.ListField(child=serializers.DictField())
    commitments = serializers.DictField()
    expenses = serializers.ListField(child=serializers.DictField(), required=False)
